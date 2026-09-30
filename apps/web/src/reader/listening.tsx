import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { Chapter, ChapterSummary } from '../api/queries';
import { usePlayer, usePlayerState } from '../app/context';
import { rangeFor } from './text';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Lo que une el texto con el audio (frontend §6.1): resalta la oración que suena, la sigue
 * con scroll suave (si haces scroll a mano, el seguimiento se pausa y aparece "Volver a la
 * oración actual") y ofrece "Escuchar desde aquí" al tocar una oración.
 */
export function useListening({
  prose,
  chapter,
  summary,
  bookId,
  ready,
}: {
  prose: RefObject<HTMLDivElement | null>;
  chapter: Chapter;
  summary: ChapterSummary;
  bookId: string;
  /** Cambia cuando la prosa se vuelve a insertar (los rangos apuntan a sus nodos). */
  ready: unknown;
}): { offer: (x: number, y: number, sentence: number) => void; overlay: ReactNode } {
  const player = usePlayer();
  const here = usePlayerState((s) => s.loaded?.chapterId === chapter.id);
  const sentence = usePlayerState((s) => s.sentence);
  const playing = usePlayerState((s) => s.playing);
  const follow = usePlayerState((s) => s.follow);
  const [chip, setChip] = useState<{ left: number; top: number; sentence: number } | null>(null);

  const currentRange = (index: number) => {
    const s = chapter.sentences[index];
    const block =
      s && s.blockIndex >= 0 ? prose.current?.querySelectorAll('[data-b]')[s.blockIndex] : null;
    return block && s ? rangeFor(block, s.start, s.end) : null;
  };

  /** Mantiene la oración a un tercio de la pantalla, solo si se salió de la zona visible. */
  const scrollToCurrent = (force: boolean) => {
    const range = here ? currentRange(sentence) : null;
    if (!range) return;
    const rect = range.getBoundingClientRect();
    const top = document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 60;
    const bottom = window.innerHeight - (document.querySelector('.player')?.clientHeight ?? 0);
    if (!force && rect.top > top + 24 && rect.bottom < bottom - 24) return;
    window.scrollTo({
      top: window.scrollY + rect.top - window.innerHeight * 0.33,
      behavior: reducedMotion() ? 'auto' : 'smooth',
    });
  };

  // Resaltado de la oración que suena (CSS Custom Highlight API, sin tocar el DOM).
  useEffect(() => {
    if (!('highlights' in CSS)) return;
    const range = here && sentence >= 0 ? currentRange(sentence) : null;
    if (range) CSS.highlights.set('lectio-current', new Highlight(range));
    else CSS.highlights.delete('lectio-current');
    if (range && follow && playing) scrollToCurrent(false);
    // currentRange y scrollToCurrent dependen de lo mismo que el efecto.
  }, [here, sentence, follow, playing, ready, chapter]);

  useEffect(() => () => void CSS.highlights?.delete('lectio-current'), []);

  // Si el lector hace scroll mientras suena el audio, el seguimiento se pausa.
  useEffect(() => {
    if (!here || !playing) return;
    const pause = () => player.setFollow(false);
    const onKey = (event: KeyboardEvent) => {
      if (['PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key))
        pause();
    };
    window.addEventListener('wheel', pause, { passive: true });
    window.addEventListener('touchmove', pause, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('wheel', pause);
      window.removeEventListener('touchmove', pause);
      document.removeEventListener('keydown', onKey);
    };
  }, [here, playing, player]);

  // El globo se cierra con un clic fuera, con Escape o al cambiar de capítulo.
  useEffect(() => setChip(null), [chapter.id]);
  useEffect(() => {
    if (!chip) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.listen-chip, .prose')) setChip(null);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setChip(null);
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [chip]);

  const overlay = (
    <>
      {chip &&
        createPortal(
          <button
            type="button"
            className="listen-chip"
            style={{ left: chip.left, top: chip.top }}
            onClick={(event) => {
              event.stopPropagation();
              setChip(null);
              void player.playFrom(bookId, chapter.id, chip.sentence);
            }}
          >
            ▶ Escuchar desde aquí
          </button>,
          document.body,
        )}
      {here &&
        playing &&
        !follow &&
        createPortal(
          <button
            type="button"
            className="follow-return"
            onClick={() => {
              player.setFollow(true);
              scrollToCurrent(true);
            }}
          >
            ↓ Volver a la oración actual
          </button>,
          document.body,
        )}
    </>
  );

  return {
    overlay,
    offer(x, y, index) {
      // Solo si el capítulo tiene audio en alguna voz (o es el que suena).
      if (!here && !player.hasAudio(summary)) return;
      const width = 190;
      setChip({
        left: Math.max(
          12,
          Math.min(
            x + window.scrollX - width / 2,
            window.scrollX + document.documentElement.clientWidth - width - 12,
          ),
        ),
        top: y + window.scrollY + 14,
        sentence: index,
      });
    },
  };
}
