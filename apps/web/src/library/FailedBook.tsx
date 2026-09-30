import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { BookSummary } from '../api/queries';
import { PixelArt } from '../components/art';
import { Pixel } from '../theme/pixel';
import { Sound } from '../theme/sound';
import { bookErrorMessage } from './book-messages';
import { CARD_WIDTH, spineSize } from './shelves';

/** Arde, queda en cenizas y renace: cuánto dura cada parte (en library.css, `burn-*`). */
const BURN_MS = 1300;
const ASH_MS = 600;
const REBORN_MS = 700;

type Phase = 'burning' | 'ash' | 'reborn' | 'card';

/**
 * Un libro que el worker no pudo preparar (DRM, archivo dañado…). La primera vez que se
 * ve (`burn`), el lomo arde, queda en cenizas y renace con chispas convertido en una
 * tarjeta con el motivo en lenguaje simple y "Quitar de mi estudio"; después, queda la
 * tarjeta directamente. En Clásico, el lomo se desvanece y aparece la tarjeta.
 */
export function FailedBook({
  book,
  burn,
  onBurnt,
  onRemove,
}: {
  book: BookSummary;
  burn: boolean;
  onBurnt: () => void;
  onRemove: () => void;
}) {
  const [phase, setPhase] = useState<Phase>(burn ? 'burning' : 'card');
  const fire = useMemo(() => Pixel.flames(), []);
  const { width, height } = spineSize(book);

  useEffect(() => {
    if (!burn) return;
    Sound.play('burn');
    const timers = [
      window.setTimeout(() => setPhase('ash'), BURN_MS),
      window.setTimeout(() => {
        setPhase('reborn');
        Sound.play('reborn');
      }, BURN_MS + ASH_MS),
      window.setTimeout(
        () => {
          setPhase('card');
          onBurnt();
        },
        BURN_MS + ASH_MS + REBORN_MS,
      ),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
    // Solo al montar: la secuencia no se repite aunque cambie el libro en la caché.
  }, []);

  const title = book.title ?? 'Sin título';
  return (
    <div
      className={`failed-book is-${phase}`}
      style={
        {
          '--spine-w': `${width}px`,
          '--spine-h': `${height}px`,
          '--card-w': `${CARD_WIDTH}px`,
        } as CSSProperties
      }
    >
      {(phase === 'burning' || phase === 'ash') && (
        <div className="burning-spine" aria-hidden="true">
          <span className="spine-title">{title}</span>
          <PixelArt className="burn-fire" svg={fire} />
        </div>
      )}
      {phase !== 'burning' && <div className="burn-ash" aria-hidden="true" />}
      {phase === 'reborn' && (
        <div className="burn-sparks" aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} style={{ '--i': i } as CSSProperties} />
          ))}
        </div>
      )}
      {(phase === 'reborn' || phase === 'card') && (
        <article className="failed-card" aria-label={`${title}: no se pudo preparar`}>
          <h3>{title}</h3>
          <p>{bookErrorMessage(book.errorCode)}</p>
          <button type="button" onClick={onRemove}>
            Quitar de mi estudio
          </button>
        </article>
      )}
    </div>
  );
}
