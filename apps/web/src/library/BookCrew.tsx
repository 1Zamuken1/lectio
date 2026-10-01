import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PixelArt } from '../components/art';
import { useTheme } from '../theme/theme';
import { crewArt } from '../theme/world-art';

/** El sprite mide 48 × 24 píxeles de arte; se dibuja a 3× (el tamaño del búho). */
const SCALE = 3;
const WIDTH = 48 * SCALE;
const HEIGHT = 24 * SCALE;
/** Centro del libro gigante dentro del sprite (x = 11 + 37 / 2). */
const BOOK_CENTER = 29.5 * SCALE;
/** La canasta del ascensor (Bosque): 20 × 39 píxeles de arte, a la misma escala. */
const LIFT_WIDTH = 20 * SCALE;
const LIFT_HEIGHT = 39 * SCALE;
/** Lo mínimo que dura la entrada, aunque el worker termine antes. */
const WALK_MS = 2800;
const CHEER_MS = 900;
const LEAVE_MS = 1400;

type Phase = 'walking' | 'waiting' | 'placed' | 'leaving';

/**
 * La cuadrilla que trae un libro recién subido: aparece en una punta de la tabla de la
 * repisa (la que le deja más camino; nunca fuera de la tabla, que sería caminar en el
 * aire), camina con el libro en alto, uno tropieza, y lo deja en su hueco (`data-book-id`). Si el worker aún no termina, esperan ahí; cuando `ready`,
 * el lomo aparece (`onPlaced`), festejan y se van (`onGone`). No bloquea nada: la
 * cuadrilla no recibe clics. Se dibuja dentro de la repisa (portal, coordenadas relativas
 * a ella): si la repisa se mueve mientras caminan, se mueven con ella.
 */
export function BookCrew({
  bookId,
  ready,
  onPlaced,
  onGone,
}: {
  bookId: string;
  ready: boolean;
  onPlaced: () => void;
  onGone: () => void;
}) {
  const { world } = useTheme();
  // Se elige una vez: si cambia el mundo a mitad de camino, terminan como empezaron.
  const [art] = useState(() => crewArt(world));
  const svg = art.svg;
  const element = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('walking');
  const [place, setPlace] = useState<{
    shelf: Element;
    from: number;
    to: number;
    top: number;
    /** Camina hacia la izquierda: el sprite se da vuelta. */
    flip: boolean;
  } | null>(null);
  const callbacks = useRef({ onPlaced, onGone });
  useEffect(() => {
    callbacks.current = { onPlaced, onGone };
  });

  // Dónde está el hueco: se busca unos cuadros, porque la repisa puede estar redibujándose.
  useEffect(() => {
    let tries = 0;
    let timer = 0;
    const find = () => {
      const slot = document.querySelector(`[data-book-id="${CSS.escape(bookId)}"]`);
      const shelf = slot?.closest('.shelf');
      if (!slot || !shelf) {
        if (++tries < 40) timer = window.setTimeout(find, 50);
        else {
          callbacks.current.onPlaced();
          callbacks.current.onGone();
        }
        return;
      }
      const s = slot.getBoundingClientRect();
      const r = shelf.getBoundingClientRect();
      const center = s.left - r.left + s.width / 2;
      const rightEnd = Math.max(0, r.width - WIDTH);
      // Desde la izquierda, el libro (a BOOK_CENTER del borde) queda sobre el hueco; desde
      // la derecha el sprite va dado vuelta, así que el libro queda a WIDTH - BOOK_CENTER.
      const fromLeft = center - BOOK_CENTER;
      const fromRight = center - (WIDTH - BOOK_CENTER);
      // Con ascensor (el Bosque), llegan siempre por la punta derecha, donde está la canasta.
      const flip = art.lift ? true : rightEnd - fromRight > fromLeft;
      // La tabla está 10 px sobre el pie del hueco (padding de .slot).
      setPlace({
        shelf,
        flip,
        from: flip ? rightEnd : 0,
        to: Math.min(rightEnd, Math.max(0, flip ? fromRight : fromLeft)),
        top: s.bottom - r.top - 10 - HEIGHT,
      });
    };
    find();
    return () => window.clearTimeout(timer);
    // art se elige una vez al montar.
  }, [bookId]);

  // La entrada: de la punta de la repisa al hueco, a pasos.
  useEffect(() => {
    const node = element.current;
    if (!place || !node) return;
    const face = place.flip ? ' scaleX(-1)' : '';
    // Aparecen en la punta de la tabla (un par de pasos de opacidad) y caminan al hueco.
    const walk = node.animate(
      [
        { transform: `translateX(${place.from}px)${face}`, opacity: 0 },
        { transform: `translateX(${place.from}px)${face}`, opacity: 1, offset: 0.06 },
        { transform: `translateX(${place.to}px)${face}`, opacity: 1 },
      ],
      { duration: WALK_MS, easing: `steps(${Math.round(WALK_MS / 100)})`, fill: 'forwards' },
    );
    walk.onfinish = () => setPhase('waiting');
    return () => walk.cancel();
  }, [place]);

  // Al llegar y estar listo: lo deja, festejan y se van por donde vinieron.
  useEffect(() => {
    if (phase !== 'waiting' || !ready) return;
    setPhase('placed');
    callbacks.current.onPlaced();
  }, [phase, ready]);

  useEffect(() => {
    const node = element.current;
    if (!node || !place) return;
    if (phase === 'placed') {
      const timer = window.setTimeout(() => setPhase('leaving'), CHEER_MS);
      return () => window.clearTimeout(timer);
    }
    if (phase === 'leaving') {
      // De vuelta por donde vinieron (mirando al otro lado) y se desvanecen en la punta.
      const face = place.flip ? '' : ' scaleX(-1)';
      const leave = node.animate(
        [
          { transform: `translateX(${place.to}px)${face}`, opacity: 1 },
          { transform: `translateX(${place.from}px)${face}`, opacity: 1, offset: 0.9 },
          { transform: `translateX(${place.from}px)${face}`, opacity: 0 },
        ],
        { duration: LEAVE_MS, easing: `steps(${Math.round(LEAVE_MS / 100)})`, fill: 'forwards' },
      );
      leave.onfinish = () => callbacks.current.onGone();
      return () => leave.cancel();
    }
  }, [phase, place]);

  if (!place) return null;
  return createPortal(
    <>
      {/* La canasta del ascensor queda fija en la punta de la repisa: sube y baja. */}
      {art.lift && (
        <div
          className={`crew-lift is-${phase}`}
          style={{ top: place.top + HEIGHT - LIFT_HEIGHT, width: LIFT_WIDTH, height: LIFT_HEIGHT }}
          aria-hidden="true"
        >
          <PixelArt svg={art.lift} />
        </div>
      )}
      <div
        ref={element}
        className={`book-crew is-${phase}`}
        style={{
          top: place.top,
          width: WIDTH,
          height: HEIGHT,
          ['--walk' as string]: `${WALK_MS}ms`,
        }}
        aria-hidden="true"
      >
        <PixelArt svg={svg} />
      </div>
    </>,
    place.shelf,
  );
}
