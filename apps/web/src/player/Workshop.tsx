import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePlayerState } from '../app/context';
import { Sound } from '../theme/sound';
import { hasCrew, useTheme } from '../theme/theme';
import { workshopArt } from '../theme/world-art';
import type { Job } from './controller';

const jobId = (job: Job) => `${job.chapterId}:${job.voiceId}`;

/**
 * El taller de copistas (Scriptorium): mientras se genera lo que pediste (no lo pedido
 * por adelantado), la cuadrilla de la voz aparece sobre el reproductor y escribe el
 * pergamino con el progreso real del worker (done/total). Al terminar, lo entregan por la
 * puerta y suena la campanita. Es decoración: no captura clics.
 */
export function Workshop({ bookId }: { bookId: string }) {
  const { world } = useTheme();
  const jobs = usePlayerState((s) => s.jobs);
  const [shown, setShown] = useState<{ id: string; voice: string; svg: string } | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const available = hasCrew(world, 'workshop');

  const tracked = shown ? Object.values(jobs).find((j) => jobId(j) === shown.id) : undefined;
  const active = Object.values(jobs).find(
    (j) =>
      j.bookId === bookId && !j.prefetch && (j.status === 'pending' || j.status === 'processing'),
  );

  // Qué trabajo se muestra: al terminar el que se sigue, festejo; si no, el activo.
  useEffect(() => {
    if (!available) {
      setShown(null);
      return;
    }
    if (finishing) return;
    if (shown && tracked?.status === 'ready') {
      setFinishing(true);
      return;
    }
    if (!active) {
      if (shown) {
        setLeaving(true);
        const timer = window.setTimeout(() => {
          setShown(null);
          setLeaving(false);
        }, 450);
        return () => window.clearTimeout(timer);
      }
      return;
    }
    if (shown?.id !== jobId(active)) {
      setLeaving(false);
      setShown({
        id: jobId(active),
        voice: active.voiceId,
        svg: workshopArt(world, active.voiceId),
      });
    }
  }, [available, finishing, shown, tracked?.status, active, world]);

  // El festejo: pergamino completo, lo llevan a la puerta, campana y se van.
  useEffect(() => {
    if (!finishing) return;
    const quick = document.documentElement.dataset.motion !== 'full';
    const bell = window.setTimeout(() => Sound.play('bell', { force: true }), quick ? 150 : 2600);
    const end = window.setTimeout(
      () => {
        setFinishing(false);
        setShown(null);
      },
      quick ? 900 : 4300,
    );
    return () => {
      window.clearTimeout(bell);
      window.clearTimeout(end);
    };
  }, [finishing]);

  // Descubre los renglones del pergamino según el progreso (0 a 1).
  const progress = finishing ? 1 : tracked && tracked.total ? tracked.done / tracked.total : 0;
  useLayoutEffect(() => {
    const rows = [...(host.current?.querySelectorAll<SVGRectElement>('.ws-row') ?? [])];
    rows.forEach((row, i) => {
      const fill = Math.max(0, Math.min(1, progress * rows.length - i));
      const width = (Number(row.dataset.to) - Number(row.dataset.from)) * fill;
      row.setAttribute('width', String(Math.round(width)));
    });
    host.current?.querySelector('svg')?.classList.toggle('ws-done', finishing);
  }, [progress, finishing, shown]);

  if (!shown) return null;
  return (
    <div
      ref={host}
      className={`workshop${leaving ? ' leaving' : ''}`}
      aria-hidden="true"
      // SVG de pixel.js (sprites propios, sin datos del usuario).
      dangerouslySetInnerHTML={{ __html: shown.svg }}
    />
  );
}
