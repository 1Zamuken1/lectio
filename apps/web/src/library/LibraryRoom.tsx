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
import { RasterArt } from '../components/RasterArt';
import { takeIosInstallHint } from '../pwa/install';
import { useAvailableOffline, useOnline } from '../pwa/online';
import { Sound } from '../theme/sound';
import { hasHoloBookcase, roomTitle, useTheme } from '../theme/theme';
import type { RasterScene, SceneRect } from '../theme/bosque-scenes';
import { Solarpunk } from '../theme/solarpunk';
import { rasterScene, worldArt } from '../theme/world-art';
import { companionLine } from './companion-voice';
import { progressLabel } from './progress';
import { useRoomDoor } from './room-door';
import {
  SORT_LABELS,
  filterBooks,
  holoSlotWidth,
  packShelves,
  sortBooks,
  spineSize,
  type ShelfSort,
} from './shelves';

const SPINE_COLORS = ['red', 'blue', 'green', 'red-d', 'blue-d', 'gold-d'];

export type Room = 'monastery' | 'study';

/** Cada sala: cuántas filas caben a lo más y el orden inicial (el título y la escena, del mundo). */
const ROOMS: Record<Room, { maxRows: number; sort: ShelfSort }> = {
  monastery: { maxRows: 3, sort: 'title' },
  study: { maxRows: 2, sort: 'reading' },
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
  const { world } = useTheme();
  const scene = useMemo(() => worldArt(world, room), [world, room]);
  // Los mundos de lienzo (el Bosque) ponen la estantería sobre la que dibuja la escena.
  const raster = rasterScene(world, room);
  const roomRef = useRef<HTMLElement>(null);
  const layout = useSceneLayout(roomRef, raster);
  const owlSvg = useMemo(() => worldArt(world, 'companion'), [world]);
  const doorOpen = useRoomDoor((s) => s.phase === 'opening' || s.phase === 'out');
  const book = books?.find((b) => b.id === selected) ?? null;
  const online = useOnline();
  const availableOffline = useAvailableOffline();
  const dimmed = (b: BookSummary) => !online && !availableOffline(b.id);
  // En iPhone, la primera vez, el búho cuenta cómo instalar (no hay botón: es desde Compartir).
  const [iosHint, setIosHint] = useState(() => takeIosInstallHint());

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ShelfSort>(ROOMS[room].sort);
  const [page, setPage] = useState(0);
  const shelfRef = useRef<HTMLDivElement>(null);
  const { width, rows } = useShelfFit(shelfRef, raster?.shelf ? 1 : ROOMS[room].maxRows);
  const browsing = (books?.length ?? 0) >= BROWSE_FROM;
  const visible = useMemo(
    () => sortBooks(filterBooks(books ?? [], query), sort),
    [books, query, sort],
  );
  // En el Solarpunk, los libros son libros de luz en un panel holográfico (todos iguales).
  const holo = hasHoloBookcase(world) && !!raster?.shelf;
  const shelves = useMemo(
    () => packShelves(visible, width, rows, holo ? holoSlotWidth : undefined),
    [visible, width, rows, holo],
  );
  // El libro de luz armado con el dedo: el primer toque lo proyecta, el segundo lo abre.
  const [armed, setArmed] = useState<string | null>(null);
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
    if (!notice) return;
    react();
    // Lumen se encoge con su sonido (el búho del Scriptorium no tiene uno).
    if (companionLine(world, notice.text).mood === 'error') Sound.play('sad');
  }, [notice, world]);

  useEffect(() => {
    if (focus && focus.open !== false) setSelected(focus.bookId);
  }, [focus]);

  function choose(id: string | null) {
    if (id === selected) return;
    setIosHint(false);
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

  const line = companionLine(
    world,
    notice?.text ??
      (iosHint
        ? 'Para tener Lectio en tu iPhone: toca Compartir y luego «Añadir a pantalla de inicio».'
        : !online && !book
          ? books?.length
            ? 'Sin conexión: te muestro los libros de tu última visita.'
            : 'Sin conexión por ahora.'
          : hint(book)),
  );

  return (
    <main
      ref={roomRef}
      className={`library${book ? ' has-selection' : ''}${doorOpen ? ' door-open' : ''}`}
      data-room={room}
      data-layout={raster?.shelf ? 'scene' : undefined}
      data-bookcase={holo ? 'holo' : undefined}
      style={layout}
      onClick={(event) => {
        if (armed && !(event.target as Element).closest('.slot')) setArmed(null);
      }}
    >
      {/* Solo el clic en la puerta: el teclado usa el botón de la barra. */}
      <div
        className="library-scene"
        onClick={(event) => {
          if ((event.target as Element).closest('.px-door')) onDoor();
        }}
      >
        {raster ? (
          <RasterArt className="scene" scene={raster} />
        ) : (
          <PixelArt className="scene" svg={scene} />
        )}
        {raster?.door && <span className="px-door scene-door" aria-hidden="true" />}
      </div>
      <div className="library-floor">
        <h1 className="room-title">{roomTitle(world, room)}</h1>
        <section className="bookcase" aria-label="Estantería">
          {owlSvg && (
            <div
              ref={owl}
              className={`shelf-owl companion-slot${line.mood === 'error' ? ' is-sad' : ''}`}
              aria-hidden="true"
            >
              <PixelArt svg={owlSvg} />
            </div>
          )}
          <p ref={hintRef} className="shelf-hint" aria-live="polite">
            {line.text}
            {notice?.action ? (
              <button type="button" className="hint-action" onClick={notice.action.run}>
                {notice.action.label}
              </button>
            ) : (
              iosHint && (
                <button type="button" className="hint-action" onClick={() => setIosHint(false)}>
                  Entendido
                </button>
              )
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
              <p>
                {online
                  ? 'Buscando los libros…'
                  : 'Sin conexión, y aún no hay libros guardados en este dispositivo.'}
              </p>
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
                  <div
                    className={`slot${armed === b.id ? ' is-armed' : ''}`}
                    key={b.id}
                    data-book-id={b.id}
                  >
                    {renderBook?.(b) ??
                      (holo ? (
                        <LightBook
                          book={b}
                          index={i}
                          hidden={hiddenIds?.has(b.id) ?? false}
                          dimmed={dimmed(b)}
                          pressed={b.id === selected}
                          armed={armed === b.id}
                          onArm={() => setArmed(b.id)}
                          onOpen={() => {
                            setArmed(null);
                            choose(b.id === selected ? null : b.id);
                          }}
                        />
                      ) : (
                        <Spine
                          book={b}
                          index={i}
                          hidden={hiddenIds?.has(b.id) ?? false}
                          dimmed={dimmed(b)}
                          pressed={b.id === selected}
                          onClick={() => choose(b.id === selected ? null : b.id)}
                        />
                      ))}
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
  dimmed,
  pressed,
  onClick,
}: {
  book: BookSummary;
  index: number;
  hidden: boolean;
  /** Sin conexión y sin nada descargado: se ve apagado, pero su ficha se abre igual. */
  dimmed: boolean;
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
      className={`spine${preparing ? ' is-preparing' : ''}${hidden ? ' is-awaited' : ''}${dimmed ? ' is-offline' : ''}`}
      style={
        {
          '--spine': `var(--px-${color})`,
          '--spine-w': `${width}px`,
          '--spine-h': `${height}px`,
          '--i': index,
        } as CSSProperties
      }
      aria-pressed={pressed}
      aria-label={`${title}${book.author ? `, de ${book.author}` : ''}${dimmed ? ' (sin conexión)' : ''}`}
      onClick={onClick}
    >
      <span className="spine-title" aria-hidden="true">
        {title}
      </span>
      {preparing && <span className="spine-progress" aria-hidden="true" />}
    </button>
  );
}

/**
 * Las portadas del holograma, barajadas una vez por visita: cada libro del estante toma la
 * siguiente, sin repetir hasta agotarlas (docs/lectio-temas.md §7.8).
 */
const COVER_ORDER = (() => {
  const order = [...Solarpunk.COVERS];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
})();

/**
 * Un libro de luz del panel holográfico (Solarpunk): un cartucho de cristal del color del
 * libro. Al pasar el cursor o al enfocarlo, el libro se proyecta encima como holograma
 * (la portada, el título, el autor y dónde vas) con su botón "Abrir"; el clic lo abre.
 * Con el dedo no hay "pasar por encima": el primer toque lo proyecta y el segundo lo abre.
 */
function LightBook({
  book,
  index,
  hidden,
  dimmed,
  pressed,
  armed,
  onArm,
  onOpen,
}: {
  book: BookSummary;
  index: number;
  hidden: boolean;
  dimmed: boolean;
  pressed: boolean;
  armed: boolean;
  onArm: () => void;
  onOpen: () => void;
}) {
  const { seed } = spineSize(book);
  const color = SPINE_COLORS[seed % SPINE_COLORS.length];
  const emblem = Solarpunk.EMBLEMS[seed % Solarpunk.EMBLEMS.length] ?? 'dot';
  const preparing = isPreparing(book);
  const title = preparing ? 'Preparando…' : (book.title ?? 'Sin título');
  const touch = useRef(false);
  const art = useMemo(() => Solarpunk.lightBook(emblem), [emblem]);
  const cover = useMemo(
    () => Solarpunk.cover(COVER_ORDER[index % COVER_ORDER.length] ?? 'luna'),
    [index],
  );
  return (
    <>
      <button
        type="button"
        className={`spine light-book${preparing ? ' is-preparing' : ''}${hidden ? ' is-awaited' : ''}${dimmed ? ' is-offline' : ''}`}
        style={{ '--spine': `var(--px-${color})`, '--i': index } as CSSProperties}
        aria-pressed={pressed}
        aria-label={`${title}${book.author ? `, de ${book.author}` : ''}${dimmed ? ' (sin conexión)' : ''}`}
        onPointerDown={(event) => {
          touch.current = event.pointerType !== 'mouse';
        }}
        onKeyDown={() => {
          touch.current = false;
        }}
        onClick={() => {
          if (touch.current && !armed && !pressed) onArm();
          else onOpen();
        }}
      >
        <PixelArt svg={art} />
        {preparing && <span className="spine-progress" aria-hidden="true" />}
      </button>
      {!preparing && !hidden && (
        <div
          className="holo-projection"
          style={{ '--spine': `var(--px-${color})` } as CSSProperties}
        >
          <div className="holo-card">
            <PixelArt className="holo-cover" svg={cover} />
            <strong>{title}</strong>
            <small>
              {book.author ? `${book.author} · ` : ''}
              {progressLabel(book) ?? 'Sin abrir'}
            </small>
            <button type="button" className="holo-open" tabIndex={-1} onClick={onOpen}>
              Abrir
            </button>
          </div>
          <span className="holo-beam" aria-hidden="true" />
        </div>
      )}
    </>
  );
}

/** Un lomo mide unos 34 píxeles de escena de alto: así los libros reales calzan con los dibujados. */
const SPINE_SCENE_HEIGHT = 34;
/** El alto medio de un lomo en la interfaz (spineSize: de 150 a 182 px). */
const SPINE_HEIGHT = 166;

/**
 * Las coordenadas de una escena de lienzo (320 × 180, recortada como `cover` en su
 * `focus`) pasadas a píxeles de la sala: dónde va la estantería real y dónde está la
 * puerta, y la escala de los lomos para que midan lo que los dibujados.
 */
function useSceneLayout(
  ref: RefObject<HTMLElement | null>,
  scene: RasterScene | null,
): CSSProperties | undefined {
  const [style, setStyle] = useState<CSSProperties>();
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !scene?.shelf) {
      setStyle(undefined);
      return;
    }
    const measure = () => {
      const w = element.clientWidth;
      const h = element.clientHeight;
      const s = Math.max(w / 320, h / 180);
      const ox = (w - 320 * s) * scene.focus[0];
      const oy = (h - 180 * s) * scene.focus[1];
      const vars: Record<string, string | number> = {
        '--spine-k': ((SPINE_SCENE_HEIGHT * s) / SPINE_HEIGHT).toFixed(4),
      };
      const put = (name: string, r: SceneRect) => {
        vars[`--${name}-x`] = `${Math.round(ox + r.x * s)}px`;
        vars[`--${name}-y`] = `${Math.round(oy + r.y * s)}px`;
        vars[`--${name}-w`] = `${Math.round(r.w * s)}px`;
        vars[`--${name}-h`] = `${Math.round(r.h * s)}px`;
      };
      put('shelf', scene.shelf!);
      if (scene.door) put('door', scene.door);
      setStyle((previous) =>
        JSON.stringify(previous) === JSON.stringify(vars) ? previous : (vars as CSSProperties),
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, scene]);
  return style;
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
