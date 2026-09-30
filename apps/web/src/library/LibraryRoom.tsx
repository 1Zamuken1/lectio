import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { isPreparing, type BookSummary } from '../api/queries';
import { ApiImage } from '../components/ApiImage';
import { Icon, PixelArt } from '../components/art';
import { Pixel } from '../theme/pixel';
import { Sound } from '../theme/sound';
import { useRoomDoor } from './room-door';

const SPINE_COLORS = ['red', 'blue', 'green', 'red-d', 'blue-d', 'gold-d'];

function hash(text: string): number {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.codePointAt(0)!, 16777619);
  return value >>> 0;
}

export type Room = 'monastery' | 'study';

const ROOMS: Record<Room, { title: string; scene: () => string }> = {
  monastery: { title: 'La biblioteca del monasterio', scene: () => Pixel.monasteryScene() },
  study: { title: 'Tu estudio', scene: () => Pixel.studyScene() },
};

/**
 * Una sala con su estantería (portado de la biblioteca de la CLI): la escena ocupa la
 * pantalla, la estantería está dentro y la ficha del libro flota encima (en el celular,
 * sube desde abajo), así que abrirla no mueve nada. Sabio, el búho, comenta la elección.
 * La puerta dibujada en la escena lleva a la otra sala (`onDoor`); la barra tiene el
 * mismo botón para el teclado y el celular, donde la puerta queda fuera del encuadre.
 * `notice` hace hablar al búho (subidas, errores) y `focus` elige un libro desde afuera
 * (por ejemplo, el que ya tenías al subirlo de nuevo); cada uno cambia con su `id`.
 */
export function LibraryRoom({
  room,
  onDoor,
  books,
  loading,
  empty,
  hint,
  renderDetail,
  notice = null,
  focus = null,
  tools,
  children,
}: {
  room: Room;
  onDoor: () => void;
  books: BookSummary[] | undefined;
  loading: boolean;
  empty: ReactNode;
  hint: (book: BookSummary | null) => string;
  renderDetail: (book: BookSummary, close: () => void) => ReactNode;
  notice?: { text: string; id: number } | null;
  focus?: { bookId: string; id: number } | null;
  /** Controles de la estantería (Añadir libro), sobre los estantes. */
  tools?: ReactNode;
  children?: ReactNode;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const owl = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const scene = useMemo(() => ROOMS[room].scene(), [room]);
  const owlSvg = useMemo(() => Pixel.owlBadge(), []);
  const doorOpen = useRoomDoor((s) => s.phase === 'opening' || s.phase === 'out');
  const book = books?.find((b) => b.id === selected) ?? null;

  useEffect(() => {
    document.body.dataset.screen = 'library';
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setSelected(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Sabio reacciona a cada aviso nuevo.
  useEffect(() => {
    if (notice) react();
  }, [notice]);

  useEffect(() => {
    if (focus) setSelected(focus.bookId);
  }, [focus]);

  function choose(id: string | null) {
    if (id === selected) return;
    setSelected(id);
    Sound.play(id ? 'select' : 'toggle');
    react();
  }

  /** El búho salta y el globo aparece: la animación se reinicia quitando y poniendo la clase. */
  function react() {
    for (const element of [owl.current, hintRef.current]) {
      if (!element) continue;
      const className = element === owl.current ? 'hop' : 'pop';
      element.classList.remove(className);
      void element.offsetWidth;
      element.classList.add(className);
    }
  }

  return (
    <main
      className={`library${book ? ' has-selection' : ''}${doorOpen ? ' door-open' : ''}`}
      data-room={room}
    >
      {/* Solo el clic en la puerta: el teclado usa el botón de la barra. */}
      <div
        className="library-scene"
        onClick={(event) => {
          if ((event.target as Element).closest('.px-door')) onDoor();
        }}
      >
        <PixelArt className="scene" svg={scene} />
      </div>
      <div className="library-floor">
        <h1 className="room-title">{ROOMS[room].title}</h1>
        <section className="bookcase" aria-label="Estantería">
          <div ref={owl} className="shelf-owl companion-slot" aria-hidden="true">
            <PixelArt svg={owlSvg} />
          </div>
          <p ref={hintRef} className="shelf-hint" aria-live="polite">
            {notice?.text ?? hint(book)}
          </p>
          {tools}
          {loading ? (
            <div className="shelf empty">
              <p>Buscando los libros…</p>
            </div>
          ) : books && books.length > 0 ? (
            <div className="shelf">
              {books.map((b, i) => (
                <div className="slot" key={b.id}>
                  <Spine
                    book={b}
                    index={i}
                    pressed={b.id === selected}
                    onClick={() => choose(b.id === selected ? null : b.id)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="shelf empty">{empty}</div>
          )}
          {children}
        </section>
      </div>
      <div className="detail-slot" hidden={!book}>
        {book && renderDetail(book, () => choose(null))}
      </div>
    </main>
  );
}

function Spine({
  book,
  index,
  pressed,
  onClick,
}: {
  book: BookSummary;
  index: number;
  pressed: boolean;
  onClick: () => void;
}) {
  const seed = hash(book.id);
  const color = SPINE_COLORS[seed % SPINE_COLORS.length];
  // Grosor según la extensión (capítulos, si se conocen); alto con algo de azar.
  const chapters = book.progress?.totalChapters ?? 12 + (seed % 20);
  const width = Math.round(Math.min(78, 36 + Math.sqrt(chapters * 25) * 1.6));
  const height = 150 + (seed % 5) * 8;
  const preparing = isPreparing(book);
  const title = preparing ? 'Preparando…' : (book.title ?? 'Sin título');
  return (
    <button
      type="button"
      className={`spine${preparing ? ' is-preparing' : ''}`}
      style={
        {
          '--spine': `var(--px-${color})`,
          '--spine-w': `${width}px`,
          '--spine-h': `${height}px`,
          '--i': index,
        } as CSSProperties
      }
      aria-pressed={pressed}
      aria-label={`${title}${book.author ? `, de ${book.author}` : ''}`}
      onClick={onClick}
    >
      <span className="spine-title" aria-hidden="true">
        {title}
      </span>
    </button>
  );
}

/** La ficha que flota sobre la escena (en el celular, sube desde abajo). */
export function DetailCard({
  book,
  onClose,
  stats,
  children,
}: {
  book: BookSummary;
  onClose: () => void;
  stats: Array<[string, string]>;
  children: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), [book.id]);
  const title = book.title ?? 'Sin título';
  return (
    <aside className="book-detail" aria-label={`Ficha de ${title}`}>
      <button
        type="button"
        className="detail-close"
        aria-label="Cerrar la ficha"
        title="Cerrar"
        onClick={onClose}
      >
        <Icon name="close" />
      </button>
      {book.coverUrl ? (
        <ApiImage className="cover" src={book.coverUrl} isPublic={book.isPublic} alt="" />
      ) : (
        <div className="cover cover-blank" aria-hidden="true">
          {title}
        </div>
      )}
      <div className="detail-body">
        <h2 ref={heading} tabIndex={-1}>
          {title}
        </h2>
        <p className="author">{book.author || 'Autor desconocido'}</p>
        <dl className="book-stats">
          {stats.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {children}
      </div>
    </aside>
  );
}
