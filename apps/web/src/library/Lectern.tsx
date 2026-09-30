import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useBookDetail, type BookSummary, type ChapterSummary } from '../api/queries';
import { ApiImage } from '../components/ApiImage';
import { Icon, PixelArt } from '../components/art';
import { Pixel } from '../theme/pixel';
import { Sound } from '../theme/sound';
import { progressLabel } from './progress';

/**
 * La ficha del libro: un libro abierto sobre el atril, al centro de la sala. En la página
 * izquierda, la portada, el autor, el progreso y "Continuar" / "Empezar"; en la derecha,
 * los capítulos narrativos agrupados por su sección, con una cinta en el que vas y una
 * marca si ya tiene audio. `href` es la ruta del lector (`/leer/:id` o `/libros/:slug`);
 * cada capítulo abre el lector en él (`?capitulo=`). Si el libro no está listo, la página
 * derecha lo dice (`status`), y `children` suma acciones al pie de la izquierda.
 */
export function Lectern({
  book,
  href,
  onClose,
  facts = [],
  status,
  children,
}: {
  book: BookSummary;
  href: string | null;
  onClose: () => void;
  facts?: Array<[string, string]>;
  status?: ReactNode;
  children?: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const stand = useMemo(() => Pixel.lecternStand(), []);
  const detail = useBookDetail(book);
  useEffect(() => heading.current?.focus({ preventScroll: true }), [book.id]);

  const title = book.title ?? 'Sin título';
  const progress = detail.data?.progress ?? book.progress;
  const chapters = detail.data?.chapters.filter((c) => c.kind === 'narrative') ?? [];
  const open = () => Sound.play('open');

  return (
    <div className="lectern">
      <button
        type="button"
        className="lectern-backdrop"
        aria-label="Cerrar la ficha"
        tabIndex={-1}
        onClick={onClose}
      />
      <aside className="lectern-book" aria-label={`Ficha de ${title}`}>
        <button
          type="button"
          className="detail-close"
          aria-label="Cerrar la ficha"
          title="Cerrar"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
        <section className="lectern-page left">
          {book.coverUrl ? (
            <ApiImage className="cover" src={book.coverUrl} isPublic={book.isPublic} alt="" />
          ) : (
            <div className="cover cover-blank" aria-hidden="true">
              {title}
            </div>
          )}
          <h2 ref={heading} tabIndex={-1}>
            {title}
          </h2>
          <p className="author">{book.author || 'Autor desconocido'}</p>
          <dl className="book-stats">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
            <div>
              <dt>Tu lectura</dt>
              <dd>{progressLabel({ ...book, progress }) ?? 'Sin empezar'}</dd>
            </div>
          </dl>
          {href && book.status === 'ready' && (
            <Link className="open-book" to={href} onClick={open}>
              {progress ? 'Continuar' : 'Empezar'}
            </Link>
          )}
          {children}
        </section>
        <section className="lectern-page right" aria-label="Capítulos">
          {status ?? (
            <>
              <h3>Capítulos</h3>
              {detail.isPending ? (
                <p className="lectern-note">Buscando los capítulos…</p>
              ) : detail.isError ? (
                <p className="lectern-note">No pude traer los capítulos. Inténtalo otra vez.</p>
              ) : (
                <ChapterList
                  chapters={chapters}
                  current={progress?.chapterOrder ?? null}
                  href={href}
                  onOpen={open}
                />
              )}
            </>
          )}
        </section>
      </aside>
      <PixelArt className="lectern-stand" svg={stand} />
    </div>
  );
}

/** Los capítulos, con un encabezado cada vez que cambia la sección (último ancestro). */
function ChapterList({
  chapters,
  current,
  href,
  onOpen,
}: {
  chapters: ChapterSummary[];
  current: number | null;
  href: string | null;
  onOpen: () => void;
}) {
  if (chapters.length === 0) return <p className="lectern-note">Este libro no tiene capítulos.</p>;
  const items: ReactNode[] = [];
  let section: string | undefined;
  for (const chapter of chapters) {
    const parent = chapter.ancestors.at(-1);
    if (parent && parent !== section) {
      items.push(
        <li key={`s-${chapter.id}`} className="lectern-section" aria-hidden="true">
          {parent}
        </li>,
      );
    }
    section = parent;
    const here = chapter.orderIndex === current;
    const withAudio = chapter.audio.some((a) => a.status === 'ready');
    const label = chapter.title ?? `Capítulo ${chapter.orderIndex + 1}`;
    const content = (
      <>
        <span className="lectern-chapter">{label}</span>
        {withAudio && (
          <span className="lectern-audio" title="Con audio">
            <Icon name="voice" />
            <span className="visually-hidden">, con audio</span>
          </span>
        )}
      </>
    );
    items.push(
      <li key={chapter.id} className={here ? 'is-current' : undefined}>
        {href ? (
          <Link
            to={`${href}?capitulo=${chapter.orderIndex}`}
            aria-current={here ? 'step' : undefined}
            onClick={onOpen}
          >
            {content}
          </Link>
        ) : (
          <span>{content}</span>
        )}
      </li>,
    );
  }
  return <ol className="lectern-chapters">{items}</ol>;
}
