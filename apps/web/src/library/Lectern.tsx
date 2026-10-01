import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  useBookDetail,
  type BookDetail,
  type BookSummary,
  type ChapterSummary,
} from '../api/queries';
import { usePlayer } from '../app/context';
import { ApiImage } from '../components/ApiImage';
import { Icon, PixelArt } from '../components/art';
import { useAvailableOffline, useOnline } from '../pwa/online';
import { Sound } from '../theme/sound';
import { useTheme } from '../theme/theme';
import { worldArt } from '../theme/world-art';
import { DownloadCrew } from './DownloadCrew';
import { ChapterDownload, DownloadNext } from './LecternDownloads';
import { progressLabel } from './progress';

/**
 * La ficha del libro: un libro abierto sobre el atril, al centro de la sala. En la página
 * izquierda, la portada, el autor, el progreso y "Continuar" / "Empezar"; en la derecha,
 * los capítulos narrativos agrupados por su sección, con una cinta en el que vas y una
 * marca si ya tiene audio, y el ícono para descargarlo (o su sello si ya está). `href` es la ruta del lector (`/leer/:id` o `/libros/:slug`);
 * cada capítulo abre el lector en él (`?capitulo=`). Si el libro no está listo, la página
 * derecha lo dice (`status`), y `children` suma acciones al pie de la izquierda.
 */
export function Lectern({
  book,
  href: link,
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
  const scene = useRef<HTMLDivElement>(null);
  const { world } = useTheme();
  const stand = useMemo(() => worldArt(world, 'lecternStand'), [world]);
  const detail = useBookDetail(book);
  const online = useOnline();
  const availableOffline = useAvailableOffline();
  const reachable = online || availableOffline(book.id);
  // Sin conexión y sin descargas, la ficha se ve (con lo guardado) pero no se abre el lector.
  const href = reachable ? link : null;
  useEffect(() => heading.current?.focus({ preventScroll: true }), [book.id]);
  // Los nombres de las voces, para los títulos de las descargas ("Descargar con Salomé").
  const player = usePlayer();
  const language = detail.data?.language;
  useEffect(() => {
    if (language) void player.loadVoices(language);
  }, [player, language]);

  const title = book.title ?? 'Sin título';
  const progress = detail.data?.progress ?? book.progress;
  const chapters = detail.data?.chapters.filter((c) => c.kind === 'narrative') ?? [];
  const reading = detail.data?.chapters.find((c) => c.orderIndex === progress?.chapterOrder);
  const chapterIds = useMemo(() => detail.data?.chapters.map((c) => c.id) ?? [], [detail.data]);
  const open = () => Sound.play('open');

  return (
    <div className="lectern" ref={scene}>
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
          {detail.data && book.status === 'ready' && chapters.length > 0 && (
            <DownloadNext book={detail.data} from={reading?.id ?? null} />
          )}
          {children}
        </section>
        <section className="lectern-page right" aria-label="Capítulos">
          {status ?? (
            <>
              {/* En el celular, la escena de las descargas (DownloadCrew). */}
              <div className="dl-strip-slot" />
              <h3>Capítulos</h3>
              {!reachable && (
                <p className="lectern-note">
                  Sin conexión: este libro no está descargado en este dispositivo.
                </p>
              )}
              {detail.isPending ? (
                !online ? null : (
                  <p className="lectern-note">Buscando los capítulos…</p>
                )
              ) : detail.isError ? (
                <p className="lectern-note">No pude traer los capítulos. Inténtalo otra vez.</p>
              ) : (
                <ChapterList
                  book={detail.data}
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
      {detail.data && (
        <DownloadCrew
          chapterIds={chapterIds}
          voiceFor={(id) => {
            const chapter = detail.data?.chapters.find((c) => c.id === id);
            return chapter ? player.downloadVoice(chapter) : null;
          }}
          scene={scene}
        />
      )}
    </div>
  );
}

/** Los capítulos, con un encabezado cada vez que cambia la sección (último ancestro). */
function ChapterList({
  book,
  chapters,
  current,
  href,
  onOpen,
}: {
  book: BookDetail;
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
        <ChapterDownload book={book} chapter={chapter} label={label} />
      </li>,
    );
  }
  return <ol className="lectern-chapters">{items}</ol>;
}
