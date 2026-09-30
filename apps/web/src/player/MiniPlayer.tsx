import { useLayoutEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router';
import { usePlayer, usePlayerState } from '../app/context';
import { ApiImage } from '../components/ApiImage';
import { Icon } from '../components/art';
import { Sound } from '../theme/sound';

/**
 * Lo que suena, fuera del lector: una barra al pie de las salas con la portada, el
 * capítulo, ▶/❚❚, una línea de progreso y "Volver al libro". El audio no se corta al
 * navegar (un único <audio> en la raíz); el ✕ lo detiene.
 */
export function MiniPlayer() {
  const player = usePlayer();
  const { pathname } = useLocation();
  const loaded = usePlayerState((s) => s.loaded);
  const playing = usePlayerState((s) => s.playing);
  const timeMs = usePlayerState((s) => s.timeMs);
  const book = usePlayerState((s) => (loaded ? s.books[loaded.bookId] : undefined));
  const bar = useRef<HTMLElement>(null);
  const chapter = book?.chapters.find((c) => c.id === loaded?.chapterId);
  // En el lector de ese libro ya está el reproductor grande.
  const visible = Boolean(loaded && book && chapter && pathname !== book.href);

  // La sala se acorta para que la barra no tape la estantería.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const node = bar.current;
    if (!visible || !node) {
      root.style.removeProperty('--mini-height');
      delete document.body.dataset.mini;
      return;
    }
    document.body.dataset.mini = 'true';
    const measure = () => root.style.setProperty('--mini-height', `${node.offsetHeight}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--mini-height');
      delete document.body.dataset.mini;
    };
  }, [visible]);

  if (!visible || !loaded || !book || !chapter) return null;
  const href = `${book.href}?capitulo=${chapter.orderIndex}`;
  const percent = Math.min(100, (100 * timeMs) / Math.max(1, loaded.durationMs));
  return (
    <section className="player mini-player" aria-label="Lo que suena" ref={bar}>
      {book.coverUrl ? (
        <ApiImage className="mini-cover" src={book.coverUrl} isPublic={book.isPublic} alt="" />
      ) : (
        <span className="mini-cover" aria-hidden="true" />
      )}
      {/* El título también lleva al libro (en el celular es el único camino). */}
      <Link className="player-meta" to={href} title="Volver al libro">
        <span className="player-title">{chapter.title}</span>
        <span className="player-book">{book.title}</span>
      </Link>
      <button
        type="button"
        className="tool play"
        aria-label={playing ? 'Pausar' : 'Reproducir'}
        title={playing ? 'Pausar' : 'Reproducir'}
        onClick={() => {
          Sound.play('toggle', { force: true });
          player.togglePlay();
        }}
      >
        <Icon name={playing ? 'pause' : 'play'} />
      </button>
      <Link className="tool mini-back" to={href} onClick={() => Sound.play('open')}>
        Volver al libro
      </Link>
      <button
        type="button"
        className="tool mini-close"
        aria-label="Dejar de escuchar"
        title="Dejar de escuchar"
        onClick={() => {
          Sound.play('toggle');
          player.stop();
        }}
      >
        <Icon name="close" />
      </button>
      <span className="mini-progress" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </span>
    </section>
  );
}
