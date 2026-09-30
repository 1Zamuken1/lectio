import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { isPreparing, type BookSummary } from '../api/queries';
import { PixelArt } from '../components/art';
import { Pixel } from '../theme/pixel';
import { Sound } from '../theme/sound';
import { useRoomDoor } from './room-door';
import {
  SORT_LABELS,
  filterBooks,
  packShelves,
  sortBooks,
  spineSize,
  type ShelfSort,
} from './shelves';

const SPINE_COLORS = ['red', 'blue', 'green', 'red-d', 'blue-d', 'gold-d'];

export type Room = 'monastery' | 'study';

/** Cada sala: su título, su escena, cuántas filas caben a lo más y el orden inicial. */
const ROOMS: Record<
  Room,
  { title: string; scene: () => string; maxRows: number; sort: ShelfSort }
> = {
  monastery: {
    title: 'La biblioteca del monasterio',
    scene: () => Pixel.monasteryScene(),
    maxRows: 3,
    sort: 'title',
  },
  study: { title: 'Tu estudio', scene: () => Pixel.studyScene(), maxRows: 2, sort: 'reading' },
};

/** Con más libros que esto aparecen buscar y ordenar. */
const BROWSE_FROM = 7;

/**
 * Una sala con su estantería (portado de la biblioteca de la CLI): la escena ocupa la
 * pantalla, la estantería está dentro y la ficha del libro se abre encima, en el atril
 * (Lectern.tsx; en el celular sube desde abajo), así que abrirla no mueve nada. Sabio, el
 * búho, comenta la elección. Con muchos libros, la estantería no crece: se reparte en
 * estantes que se pasan con flechas, y arriba se busca y se ordena (shelves.ts).
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
  hiddenIds,
  renderBook,
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
  notice?: { text: string; id: number; action?: { label: string; run: () => void } } | null;
  /** `open: false` solo lleva a su estante, sin abrir la ficha. */
  focus?: { bookId: string; id: number; open?: boolean } | null;
  /** Libros que aún no se muestran (la cuadrilla los está trayendo): guardan su hueco. */
  hiddenIds?: ReadonlySet<string>;
  /** Para dibujar un libro distinto de un lomo (la tarjeta del que falló). */
  renderBook?: (book: BookSummary) => ReactNode | undefined;
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

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ShelfSort>(ROOMS[room].sort);
  const [page, setPage] = useState(0);
  const shelfRef = useRef<HTMLDivElement>(null);
  const { width, rows } = useShelfFit(shelfRef, ROOMS[room].maxRows);
  const browsing = (books?.length ?? 0) >= BROWSE_FROM;
  const visible = useMemo(
    () => sortBooks(filterBooks(books ?? [], query), sort),
    [books, query, sort],
  );
  const shelves = useMemo(() => packShelves(visible, width, rows), [visible, width, rows]);
  const current = Math.min(page, shelves.length - 1);

  // Al cambiar la búsqueda o el orden, se vuelve al primer estante.
  useEffect(() => setPage(0), [query, sort]);

  // Si alguien elige un libro desde afuera (el que ya tenías), se va a su estante.
  const focusedId = useRef<number | null>(null);
  useEffect(() => {
    if (!focus || focusedId.current === focus.id) return;
    const at = shelves.findIndex((shelf) => shelf.some((b) => b.id === focus.bookId));
    if (at >= 0) {
      focusedId.current = focus.id;
      setPage(at);
    } else if (query) setQuery('');
  }, [focus, shelves, query]);

  function turn(to: number) {
    setPage(to);
    Sound.play('page');
  }

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
    if (focus && focus.open !== false) setSelected(focus.bookId);
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
            {notice?.action && (
              <button type="button" className="hint-action" onClick={notice.action.run}>
                {notice.action.label}
              </button>
            )}
          </p>
          {(browsing || tools) && (
            <div className="shelf-tools">
              {browsing && (
                <>
                  <label className="shelf-search">
                    <span className="visually-hidden">Buscar por título o autor</span>
                    <input
                      type="search"
                      placeholder="Buscar título o autor"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </label>
                  <label className="shelf-sort">
                    <span className="visually-hidden">Ordenar</span>
                    <select
                      value={sort}
                      onChange={(event) => setSort(event.target.value as ShelfSort)}
                    >
                      {Object.entries(SORT_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              {tools}
            </div>
          )}
          {loading ? (
            <div className="shelf empty">
              <p>Buscando los libros…</p>
            </div>
          ) : books && books.length > 0 ? (
            <div
              ref={shelfRef}
              className="shelf"
              // Con varios estantes, el alto es siempre el mismo: pasar no mueve la sala.
              style={shelves.length > 1 ? { minHeight: `${rows * 13}rem` } : undefined}
            >
              {visible.length === 0 ? (
                <p className="shelf-none">Ningún libro coincide con «{query.trim()}».</p>
              ) : (
                (shelves[current] ?? []).map((b, i) => (
                  <div className="slot" key={b.id} data-book-id={b.id}>
                    {renderBook?.(b) ?? (
                      <Spine
                        book={b}
                        index={i}
                        hidden={hiddenIds?.has(b.id) ?? false}
                        pressed={b.id === selected}
                        onClick={() => choose(b.id === selected ? null : b.id)}
                      />
                    )}
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="shelf empty">{empty}</div>
          )}
          {shelves.length > 1 && (
            <nav className="shelf-pager" aria-label="Estantes">
              <button
                type="button"
                aria-label="Estante anterior"
                disabled={current === 0}
                onClick={() => turn(current - 1)}
              >
                ‹
              </button>
              <span aria-live="polite">
                Estante {current + 1} de {shelves.length}
              </span>
              <button
                type="button"
                aria-label="Estante siguiente"
                disabled={current === shelves.length - 1}
                onClick={() => turn(current + 1)}
              >
                ›
              </button>
            </nav>
          )}
          {children}
        </section>
      </div>
      <div className="lectern-slot" hidden={!book}>
        {book && renderDetail(book, () => choose(null))}
      </div>
    </main>
  );
}

function Spine({
  book,
  index,
  hidden,
  pressed,
  onClick,
}: {
  book: BookSummary;
  index: number;
  hidden: boolean;
  pressed: boolean;
  onClick: () => void;
}) {
  const { seed, width, height } = spineSize(book);
  const color = SPINE_COLORS[seed % SPINE_COLORS.length];
  const preparing = isPreparing(book);
  const title = preparing ? 'Preparando…' : (book.title ?? 'Sin título');
  return (
    <button
      type="button"
      className={`spine${preparing ? ' is-preparing' : ''}${hidden ? ' is-awaited' : ''}`}
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
      {preparing && <span className="spine-progress" aria-hidden="true" />}
    </button>
  );
}

/** Lo que ocupa bajo los estantes: las flechas y el margen del suelo. */
const BELOW_SHELF = 96;

/**
 * El ancho de la estantería y cuántas filas caben entre su borde de arriba y el final de
 * la pantalla (entre 1 y `maxRows`): así la sala nunca crece ni la escena se estira.
 */
function useShelfFit(ref: RefObject<HTMLDivElement | null>, maxRows: number) {
  const [fit, setFit] = useState({ width: 0, rows: maxRows });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const rowHeight = parseFloat(getComputedStyle(document.documentElement).fontSize) * 13;
      const top = element.getBoundingClientRect().top + window.scrollY;
      const room = window.innerHeight - top - BELOW_SHELF;
      const rows = Math.max(1, Math.min(maxRows, Math.floor(room / rowHeight)));
      const width = element.clientWidth;
      setFit((f) => (f.width === width && f.rows === rows ? f : { width, rows }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    // También la página: cambia con el alto de la ventana aunque la estantería no.
    observer.observe(document.documentElement);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  });
  return fit;
}
