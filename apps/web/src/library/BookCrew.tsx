import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PixelArt } from '../components/art';
import { Pixel } from '../theme/pixel';

/** El sprite mide 48 × 24 píxeles de arte; se dibuja a 3× (el tamaño del búho). */
const SCALE = 3;
const WIDTH = 48 * SCALE;
const HEIGHT = 24 * SCALE;
/** Centro del libro gigante dentro del sprite (x = 11 + 37 / 2). */
const BOOK_CENTER = 29.5 * SCALE;
/** Lo mínimo que dura la entrada, aunque el worker termine antes. */
const WALK_MS = 2800;
const CHEER_MS = 900;
const LEAVE_MS = 1400;

type Phase = 'walking' | 'waiting' | 'placed' | 'leaving';

/**
 * La cuadrilla que trae un libro recién subido: entra por el extremo de la repisa (del
 * lado de la puerta), camina por la tabla con el libro en alto, uno tropieza, y lo deja en
 * su hueco (`data-book-id`). Si el worker aún no termina, esperan ahí; cuando `ready`,
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
  const svg = useMemo(() => Pixel.bookCrew(), []);
  const element = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('walking');
  const [place, setPlace] = useState<{
    shelf: Element;
    from: number;
    to: number;
    top: number;
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
      // La tabla está 10 px sobre el pie del hueco (padding de .slot).
      setPlace({
        shelf,
        from: -WIDTH,
        to: s.left - r.left + s.width / 2 - BOOK_CENTER,
        top: s.bottom - r.top - 10 - HEIGHT,
      });
    };
    find();
    return () => window.clearTimeout(timer);
  }, [bookId]);

  // La entrada: de la punta de la repisa al hueco, a pasos.
  useEffect(() => {
    const node = element.current;
    if (!place || !node) return;
    const walk = node.animate(
      [{ transform: `translateX(${place.from}px)` }, { transform: `translateX(${place.to}px)` }],
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
      const leave = node.animate(
        [
          { transform: `translateX(${place.to}px) scaleX(-1)` },
          { transform: `translateX(${place.from}px) scaleX(-1)` },
        ],
        { duration: LEAVE_MS, easing: `steps(${Math.round(LEAVE_MS / 100)})`, fill: 'forwards' },
      );
      leave.onfinish = () => callbacks.current.onGone();
      return () => leave.cancel();
    }
  }, [phase, place]);

  if (!place) return null;
  return createPortal(
    <div
      ref={element}
      className={`book-crew is-${phase}`}
      style={{ top: place.top, width: WIDTH, height: HEIGHT, ['--walk' as string]: `${WALK_MS}ms` }}
      aria-hidden="true"
    >
      <PixelArt svg={svg} />
    </div>,
    place.shelf,
  );
}
