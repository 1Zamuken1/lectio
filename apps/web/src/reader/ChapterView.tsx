import { useQueryClient } from '@tanstack/react-query';
import DOMPurify from 'dompurify';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Chapter, ChapterSummary } from '../api/queries';
import { useApi } from '../app/context';
import { Pixel } from '../theme/pixel';
import { useListening } from './listening';
import {
  KIND_LABEL,
  estimatedMinutes,
  firstSentenceByBlock,
  formatDuration,
  formatNumber,
  headingMatchesTitle,
  rangeFor,
  sentenceAtPoint,
} from './text';

interface NotePopover {
  label: string;
  html: string;
  left: number;
  top: number;
}

/**
 * Un capítulo tal como lo muestra el preview: encabezado, prosa con inicial iluminada y
 * esquineros (Scriptorium), notas en un globo y navegación al pie. Informa la oración
 * donde va la lectura (`onPosition`) y, al abrir, vuelve a `restoreSentence`.
 */
export function ChapterView({
  chapter,
  summary,
  bookId,
  isPublic,
  review,
  restoreSentence,
  previous,
  next,
  onGo,
  onPosition,
}: {
  chapter: Chapter;
  summary: ChapterSummary;
  bookId: string;
  isPublic: boolean;
  review: boolean;
  restoreSentence: number | null;
  previous: ChapterSummary | null;
  next: ChapterSummary | null;
  onGo: (orderIndex: number) => void;
  onPosition: (sentenceIndex: number) => void;
}) {
  const prose = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState<NotePopover | null>(null);
  const built = useMemo(() => buildProse(chapter.contentHtml, chapter.title), [chapter]);
  const firstByBlock = useMemo(() => firstSentenceByBlock(chapter.sentences), [chapter]);
  const corners = useMemo(() => Pixel.fleuron(), []);
  useChapterImages(prose, chapter.id, bookId, isPublic);
  const listening = useListening({ prose, chapter, summary, bookId, ready: built });

  // La prosa se inserta a mano (no con dangerouslySetInnerHTML): las imágenes y los
  // resaltados trabajan sobre estos nodos, y React no debe reemplazarlos.
  useLayoutEffect(() => {
    const node = prose.current;
    if (!node) return;
    node.replaceChildren(built.fragment.cloneNode(true));
    illuminate(node);
  }, [built]);

  // Al abrir: a la oración guardada o al principio.
  const lastBlock = useRef(-1);
  useLayoutEffect(() => {
    setNote(null);
    const sentence = restoreSentence === null ? null : chapter.sentences[restoreSentence];
    const block = sentence
      ? prose.current?.querySelectorAll('[data-b]')[sentence.blockIndex]
      : null;
    lastBlock.current = sentence?.blockIndex ?? 0;
    if (block) {
      const top = block.getBoundingClientRect().top + window.scrollY - topbarHeight() - 24;
      window.scrollTo({ top: Math.max(0, top) });
    } else {
      window.scrollTo({ top: 0 });
    }
    // restoreSentence solo cuenta al abrir el capítulo.
  }, [chapter.id]);

  // La posición es la primera oración del primer bloque visible (frontend §4.2).
  useEffect(() => {
    let scheduled = 0;
    const measure = () => {
      scheduled = 0;
      const blocks = prose.current?.querySelectorAll<HTMLElement>('[data-b]');
      if (!blocks) return;
      const line = topbarHeight() + 8;
      for (const block of blocks) {
        if (block.getBoundingClientRect().bottom <= line) continue;
        const blockIndex = Number(block.dataset.b);
        const sentence = firstByBlock.get(blockIndex);
        if (sentence === undefined) continue; // una imagen: vale el bloque siguiente
        if (blockIndex !== lastBlock.current) {
          lastBlock.current = blockIndex;
          onPosition(sentence);
        }
        return;
      }
    };
    const onScroll = () => {
      if (!scheduled) scheduled = window.setTimeout(measure, 250);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.clearTimeout(scheduled);
    };
  }, [firstByBlock, onPosition]);

  // Modo revisión: tachado lo que no se narra. La API no expone el texto narrado, así que
  // aquí no se marca lo que cambia (eso queda en el preview de la CLI).
  useEffect(() => {
    if (!('highlights' in CSS)) return;
    const node = prose.current;
    if (!review || !node) {
      CSS.highlights.delete('lectio-omitted');
      return;
    }
    const blocks = node.querySelectorAll('[data-b]');
    const omitted = new Highlight();
    for (const sentence of chapter.sentences) {
      if (sentence.narrated || sentence.blockIndex < 0) continue;
      const block = blocks[sentence.blockIndex];
      const range = block && rangeFor(block, sentence.start, sentence.end);
      if (range) omitted.add(range);
    }
    CSS.highlights.set('lectio-omitted', omitted);
    return () => void CSS.highlights.delete('lectio-omitted');
  }, [review, chapter, built]);

  // Cerrar la nota con un clic fuera o con Escape.
  useEffect(() => {
    if (!note) return;
    const onClick = (event: globalThis.MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.note-popover, a[data-lectio-note]')) setNote(null);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setNote(null);
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [note]);

  function onProseClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as Element;
    const link = target.closest<HTMLAnchorElement>('a[data-lectio-note]');
    if (!link) {
      if (target.closest('a[href]')) {
        // Los enlaces internos del EPUB no llevan a ninguna parte fuera del libro.
        if (target.closest('a[href^="#"], a[href$=".xhtml"], a[href*=".xhtml#"]'))
          event.preventDefault();
        return;
      }
      // Un toque en una oración ofrece escucharla (no si se estaba seleccionando texto).
      if (review || window.getSelection()?.isCollapsed === false) return;
      const hit = sentenceAtPoint(target, event.clientX, event.clientY, chapter.sentences);
      if (hit) listening.offer(event.clientX, event.clientY, hit.index);
      return;
    }
    event.preventDefault();
    const found = chapter.notes.find((n) => n.id === link.dataset.lectioNote);
    if (!found) return;
    const rect = link.getBoundingClientRect();
    const width = Math.min(420, document.documentElement.clientWidth - 24);
    setNote({
      label: `Nota ${link.textContent?.trim() ?? ''}`,
      html: DOMPurify.sanitize(found.html),
      left: Math.min(
        Math.max(12, rect.left + window.scrollX - width / 2),
        window.scrollX + document.documentElement.clientWidth - width - 12,
      ),
      top: rect.bottom + window.scrollY + 8,
    });
  }

  const aux = chapter.kind !== 'narrative';
  const meta = aux
    ? `${KIND_LABEL[chapter.kind]} · no se narra por defecto`
    : `≈ ${formatDuration(estimatedMinutes(summary.characterCount))} de audio · ${formatNumber(chapter.sentences.length)} oraciones`;

  return (
    <article className={`chapter${review ? ' review' : ''}`}>
      {['tl', 'tr', 'bl', 'br'].map((corner) => (
        <span
          key={corner}
          className={`page-corner ${corner}`}
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: corners }}
        />
      ))}
      <header className="chapter-header">
        {chapter.ancestors.length > 0 && (
          <div className="chapter-ancestors">{chapter.ancestors.join(' › ')}</div>
        )}
        {/* Si el capítulo abre con su propio título, el nuestro queda para lectores de pantalla. */}
        <h2 className={built.opensWithTitle ? 'chapter-title visually-hidden' : 'chapter-title'}>
          {chapter.title}
        </h2>
        <div className="chapter-meta">{meta}</div>
      </header>
      <div className="legend" aria-hidden="true">
        <span>
          <s>tachado</s>: no se narra
        </span>
      </div>
      <div className="prose" ref={prose} onClick={onProseClick} />
      <nav className="chapter-nav" aria-label="Capítulos">
        {previous ? (
          <button type="button" onClick={() => onGo(previous.orderIndex)}>
            <small>← Anterior</small>
            {previous.title}
          </button>
        ) : (
          <span />
        )}
        {next ? (
          <button type="button" onClick={() => onGo(next.orderIndex)}>
            <small>Siguiente →</small>
            {next.title}
          </button>
        ) : (
          <span />
        )}
      </nav>
      {listening.overlay}
      {note &&
        createPortal(
          <div
            className="note-popover"
            role="dialog"
            aria-label="Nota"
            style={{ left: note.left, top: note.top }}
          >
            <span className="note-label">{note.label}</span>
            <div dangerouslySetInnerHTML={{ __html: note.html }} />
          </div>,
          document.body,
        )}
    </article>
  );
}

function topbarHeight(): number {
  return document.querySelector('.topbar')?.getBoundingClientRect().height ?? 60;
}

/**
 * Sanea el HTML del capítulo (de nuevo: el pipeline ya lo limpió, pero viene de un EPUB
 * ajeno) y deja las imágenes sin `src`: su ruta es la del EPUB y se piden a la API.
 */
function buildProse(html: string, title: string) {
  const fragment = DOMPurify.sanitize(html, { RETURN_DOM_FRAGMENT: true });
  for (const img of fragment.querySelectorAll('img')) {
    const src = img.getAttribute('src');
    if (src) img.dataset.lectioSrc = src;
    img.removeAttribute('src');
    img.removeAttribute('srcset');
    img.loading = 'lazy';
  }
  const first = fragment.querySelector('[data-b]');
  const opensWithTitle =
    first !== null &&
    /^H[1-6]$/.test(first.tagName) &&
    headingMatchesTitle(first.textContent ?? '', title);
  return { fragment, opensWithTitle };
}

/**
 * Inicial iluminada en el primer párrafo con texto real (no en epígrafes ni títulos). Si
 * antes hay una imagen, el libro ya trae su propia capitular o una ilustración de
 * apertura: dos adornos seguidos sobran.
 */
function illuminate(prose: HTMLElement) {
  const first = [...prose.querySelectorAll('p')].find(
    (p) => (p.textContent ?? '').trim().length > 80 && !p.closest('blockquote, aside, figure'),
  );
  if (!first) return;
  const imageBefore = [...prose.querySelectorAll('img')].some(
    (img) => img.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
  if (!imageBefore) first.classList.add('illuminated');
}

/**
 * Las imágenes del capítulo vienen de `/books/:id/resources?path=`. Las de libros públicos
 * van directo; las de los tuyos se piden con el token y se muestran como blob (un <img>
 * no manda Authorization), con la misma caché que las portadas.
 */
function useChapterImages(
  prose: React.RefObject<HTMLDivElement | null>,
  chapterId: string,
  bookId: string,
  isPublic: boolean,
) {
  const api = useApi();
  const client = useQueryClient();
  useEffect(() => {
    let active = true;
    for (const img of prose.current?.querySelectorAll<HTMLImageElement>('img[data-lectio-src]') ??
      []) {
      const url = `/api/v1/books/${bookId}/resources?path=${encodeURIComponent(img.dataset.lectioSrc ?? '')}`;
      if (isPublic) {
        img.src = url;
        continue;
      }
      void client
        .fetchQuery({
          queryKey: ['image', url],
          queryFn: async () =>
            URL.createObjectURL(await (await api.send(url, { raw: true })).blob()),
          staleTime: Infinity,
          gcTime: 30 * 60_000,
        })
        .then((blob) => {
          if (active) img.src = blob;
        })
        .catch(() => img.classList.add('image-missing'));
    }
    return () => {
      active = false;
    };
  }, [prose, chapterId, bookId, isPublic, api, client]);
}
