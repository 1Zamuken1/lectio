import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router';
import { ApiError } from '../api/client';
import {
  useBookDetail,
  useChapter,
  usePrefetchChapter,
  useServerPosition,
  type BookDetail,
  type ChapterSummary,
} from '../api/queries';
import { usePlayer, usePlayerState, useProgress, useSession } from '../app/context';
import { useAuthPrompt } from '../auth/auth-prompt';
import { Icon } from '../components/art';
import { ModeButton, SettingsButton } from '../components/ThemeTools';
import { PlayerBar } from '../player/PlayerBar';
import { Workshop } from '../player/Workshop';
import { ChapterView } from '../reader/ChapterView';
import { Report } from '../reader/Report';
import { loadLocalPosition } from '../reader/position';
import { applyReaderPrefs, useReaderPrefs } from '../reader/prefs';
import { ReaderSidebar } from '../reader/Sidebar';
import { TextTools } from '../reader/TextTools';
import { Sound } from '../theme/sound';

/**
 * El lector: `/leer/:id` para tus libros y `/libros/:slug` para los públicos (sin cuenta).
 * El capítulo va en `?capitulo=` (su orderIndex). Sin él, abre donde ibas: la posición del
 * servidor si hay sesión, o la de este navegador.
 */
export function Reader() {
  const { id, slug } = useParams();
  const { state } = useSession();
  const ask = useAuthPrompt((s) => s.ask);
  const isPublic = slug !== undefined;
  const detail = useBookDetail({
    id: id ?? `slug:${slug}`,
    slug: slug ?? null,
    isPublic,
    // Espera a saber si hay sesión: un libro privado sin sesión daría 401.
    status: state.status === 'unknown' ? 'pending' : 'ready',
  });
  const back = isPublic ? '/biblioteca' : '/estudio';
  const size = useReaderPrefs((s) => s.size);
  const font = useReaderPrefs((s) => s.font);

  useEffect(() => {
    document.body.dataset.screen = 'reader';
  }, []);
  useEffect(() => applyReaderPrefs({ size, font }), [size, font]);

  useEffect(() => {
    if (!isPublic && state.status === 'anonymous') {
      ask({ reason: 'Este libro está en el estudio de alguien. Entra para abrir el tuyo.' });
    }
  }, [isPublic, state.status, ask]);

  const book = detail.data;
  const missing = detail.error instanceof ApiError && [401, 403, 404].includes(detail.error.status);

  if (book?.status === 'ready' && book.chapters.length > 0) {
    return <BookReader book={book} back={back} />;
  }
  return (
    <main className="reader-soon">
      <div className="reader-soon-page">
        {detail.isPending ? (
          <p>Abriendo el libro…</p>
        ) : missing || !book ? (
          <>
            <h1>No encontramos este libro</h1>
            <p>Puede que no sea tuyo o que ya no esté en la estantería.</p>
          </>
        ) : book.status === 'error' ? (
          <>
            <h1>{book.title ?? 'Este libro'}</h1>
            <p>No pudimos prepararlo para leer. En tu estudio verás qué pasó.</p>
          </>
        ) : (
          <>
            <h1>{book.title ?? 'Este libro'}</h1>
            <p>Todavía lo estamos preparando: vuelve en unos segundos.</p>
          </>
        )}
        <Link className="open-book" to={back}>
          {isPublic ? 'Volver a la biblioteca' : 'Volver a tu estudio'}
        </Link>
      </div>
    </main>
  );
}

function BookReader({ book, back }: { book: BookDetail; back: string }) {
  const [params, setParams] = useSearchParams();
  const { pathname } = useLocation();
  const { state } = useSession();
  const prefs = useReaderPrefs();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const progress = useProgress();
  const player = usePlayer();
  const prefetch = usePrefetchChapter();
  const server = useServerPosition(book.id);
  const topbar = useRef<HTMLElement>(null);

  // El reproductor conoce el libro (capítulos y voces con audio) y lo mantiene al día.
  useEffect(() => {
    player.upsertBook(book, pathname);
  }, [player, book, pathname]);
  const playerBook = usePlayerState((s) => s.books[book.id]);

  // Salir del libro guarda lo último que se leyó.
  useEffect(() => () => progress.flush(book.id, true), [progress, book.id]);

  // Dónde abrir: se decide una vez, cuando se sabe la posición guardada.
  const restore = useRef<{ chapterId: string; sentenceIndex: number } | null>(null);
  const [resolved, setResolved] = useState(false);
  const waiting =
    state.status === 'unknown' || (state.status === 'authenticated' && server.isPending);
  useEffect(() => {
    if (resolved || waiting) return;
    const fromServer = server.data?.chapterId ? server.data : null;
    const saved = fromServer ?? loadLocalPosition(book.id);
    const savedChapter = saved && book.chapters.find((c) => c.id === saved.chapterId);
    if (saved && savedChapter) {
      restore.current = { chapterId: savedChapter.id, sentenceIndex: saved.sentenceIndex };
    }
    const requested = book.chapters.find((c) => String(c.orderIndex) === params.get('capitulo'));
    const target =
      requested ??
      savedChapter ??
      book.chapters.find((c) => c.kind === 'narrative') ??
      book.chapters[0];
    if (!requested && target) {
      setParams({ capitulo: String(target.orderIndex) }, { replace: true });
    }
    setResolved(true);
  }, [resolved, waiting, server.data, book, params, setParams]);

  const index = book.chapters.findIndex((c) => String(c.orderIndex) === params.get('capitulo'));
  const summary = resolved && index >= 0 ? (book.chapters[index] ?? null) : null;
  const previous = index > 0 ? (book.chapters[index - 1] ?? null) : null;
  const next = index >= 0 ? (book.chapters[index + 1] ?? null) : null;
  const chapter = useChapter(summary?.id ?? null);

  useEffect(() => {
    if (chapter.data && next) void prefetch(next.id);
  }, [chapter.data, next, prefetch]);

  /** Dónde va la lectura en el capítulo abierto: ▶ empieza a sonar desde ahí. */
  const reading = useRef<{ chapterId: string; sentence: number } | null>(null);

  const show = useCallback(
    (target: ChapterSummary) => {
      Sound.play('page');
      restore.current = null;
      reading.current = { chapterId: target.id, sentence: 0 };
      setParams({ capitulo: String(target.orderIndex) }, { replace: true });
      document.getElementById('contenido')?.focus({ preventScroll: true });
    },
    [setParams],
  );

  /**
   * Pasa a otro capítulo. Si estabas escuchando a mitad de este, pregunta antes; si suena
   * otro capítulo, se pausa (el reproductor sigue al que lees). `play`: que suene al llegar.
   */
  const go = useCallback(
    async (orderIndex: number, options: { play?: boolean } = {}) => {
      const target = book.chapters.find((c) => c.orderIndex === orderIndex);
      setSidebarOpen(false);
      if (!target) return;
      if (target.id !== summary?.id) {
        if (summary && !(await player.confirmLeave(summary.id, target))) return;
        if (player.state.playing && !player.isLoaded(target.id)) player.pause();
        progress.record(book.id, target.id, 0);
        show(target);
      }
      if (options.play) void player.load(book.id, target.id, { play: true });
    },
    [book.id, book.chapters, summary, player, progress, show],
  );

  // El reproductor pasó solo al capítulo siguiente: el lector lo acompaña.
  const advanced = usePlayerState((s) => s.advanced);
  const lastAdvance = useRef(advanced);
  useEffect(() => {
    if (!advanced || advanced === lastAdvance.current) return;
    lastAdvance.current = advanced;
    if (advanced.from !== summary?.id) return;
    const target = book.chapters.find((c) => c.id === advanced.to);
    if (target) show(target);
  }, [advanced, summary?.id, book.chapters, show]);

  const chapterId = summary?.id;
  const onPosition = useCallback(
    (sentenceIndex: number) => {
      if (!chapterId) return;
      reading.current = { chapterId, sentence: sentenceIndex };
      // Mientras suena este capítulo, la posición la lleva el audio.
      if (player.state.playing && player.isLoaded(chapterId)) return;
      progress.record(book.id, chapterId, sentenceIndex);
    },
    [chapterId, book.id, player, progress],
  );

  const startSentence = useCallback(() => {
    const read = reading.current;
    if (read && read.chapterId === chapterId) return read.sentence;
    const saved = restore.current;
    return saved && saved.chapterId === chapterId ? saved.sentenceIndex : 0;
  }, [chapterId]);

  // ← y → pasan de capítulo; la barra espaciadora reproduce o pausa; Escape cierra el índice.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false);
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target as Element;
      if (target.closest('input, textarea, select, [role="dialog"]')) return;
      if (document.querySelector('dialog[open], .speed-menu')) return;
      if (event.key === ' ' && !target.closest('button, a') && summary) {
        if (!player.isLoaded(summary.id) && !player.hasAudio(summary)) return;
        event.preventDefault();
        if (player.isLoaded(summary.id)) player.togglePlay();
        else void player.load(book.id, summary.id, { play: true, sentence: startSentence() });
      }
      if (event.key === 'ArrowRight' && next) void go(next.orderIndex);
      if (event.key === 'ArrowLeft' && previous) void go(previous.orderIndex);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [go, next, previous, summary, player, book.id, startSentence]);

  // El índice lateral se ubica bajo la barra, cuya altura cambia en pantallas chicas.
  useLayoutEffect(() => {
    const bar = topbar.current;
    if (!bar) return;
    const measure = () =>
      document.documentElement.style.setProperty('--topbar-height', `${bar.offsetHeight}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  const restoreSentence = useMemo(
    () =>
      restore.current && restore.current.chapterId === summary?.id
        ? restore.current.sentenceIndex
        : null,
    // restore.current cambia junto con el capítulo.
    [summary?.id, resolved],
  );

  const place = back === '/estudio' ? 'Tu estudio' : 'Biblioteca';
  const goTo = (orderIndex: number) => void go(orderIndex);
  // Libro o Reporte: en la URL (?vista=reporte), así "atrás" vuelve al libro.
  const report = params.get('vista') === 'reporte';
  const setView = (view: 'book' | 'report') => {
    if ((view === 'report') === report) return;
    Sound.play('page');
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (view === 'report') next.set('vista', 'reporte');
        else next.delete('vista');
        return next;
      },
      { replace: false },
    );
    window.scrollTo({ top: 0 });
  };
  return (
    <div className="layout has-player">
      <header className="topbar" ref={topbar}>
        <button
          type="button"
          className="tool menu-toggle"
          aria-label="Mostrar índice"
          aria-expanded={sidebarOpen}
          onClick={() => {
            Sound.play('open');
            setSidebarOpen(!sidebarOpen);
          }}
        >
          <Icon name="menu" />
        </button>
        <Link className="brand" to={back} title={`Volver a ${place.toLowerCase()}`}>
          Lectio<small>{book.title ?? 'Sin título'}</small>
        </Link>
        <div className="tabs" role="tablist" aria-label="Vista">
          <button type="button" role="tab" aria-selected={!report} onClick={() => setView('book')}>
            Libro
          </button>
          <button type="button" role="tab" aria-selected={report} onClick={() => setView('report')}>
            Reporte
          </button>
        </div>
        <div className="tools">
          <TextTools />
          <Link className="tool" to={back} title={`Volver a ${place.toLowerCase()}`}>
            <Icon name="door" />
            <span className="label">{place}</span>
          </Link>
          <ModeButton />
          <SettingsButton />
        </div>
      </header>
      <ReaderSidebar
        book={book}
        currentId={summary?.id ?? null}
        hideAux={prefs.hideAux}
        open={sidebarOpen}
        onToggleAux={() => prefs.set('hideAux', !prefs.hideAux)}
        onGo={goTo}
      />
      <main className="main" id="contenido" tabIndex={-1}>
        {report ? (
          <Report
            bookId={book.id}
            onOpen={(orderIndex) => {
              setView('book');
              goTo(orderIndex);
            }}
          />
        ) : chapter.data && summary ? (
          <ChapterView
            chapter={chapter.data}
            summary={summary}
            bookId={book.id}
            isPublic={book.isPublic}
            review={prefs.review}
            restoreSentence={restoreSentence}
            previous={previous}
            next={next}
            onGo={goTo}
            onPosition={onPosition}
          />
        ) : chapter.isError ? (
          <p className="chapter-loading">
            No pudimos abrir este capítulo.{' '}
            <button type="button" className="link" onClick={() => void chapter.refetch()}>
              Reintentar
            </button>
          </p>
        ) : (
          <p className="chapter-loading">Abriendo el capítulo…</p>
        )}
      </main>
      {playerBook && summary && (
        <PlayerBar
          book={playerBook}
          chapter={playerBook.chapters.find((c) => c.id === summary.id) ?? summary}
          startSentence={startSentence}
          onGo={(orderIndex, options) => void go(orderIndex, options)}
          onStep={(target) => void go(target.orderIndex, { play: true })}
        />
      )}
      <Workshop bookId={book.id} />
    </div>
  );
}
