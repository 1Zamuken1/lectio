import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { PixelArt } from '../components/art';
import { downloads, useDownloads } from '../pwa/downloads';
import { Pixel } from '../theme/pixel';
import { Sound } from '../theme/sound';
import { hasScenes, useTheme } from '../theme/theme';

/** Los sprites se dibujan a 3×, como el pie del atril (96 px de arte → 288 px). */
const SCALE = 3;
const CARRIER = 12 * SCALE;
const CHEST_W = 20 * SCALE;
const CHEST_H = 16 * SCALE;
/** Separación entre los que esperan en la fila. */
const GAP = 6 * SCALE;
/** Lo mínimo que tarda el camino al arcón, aunque la descarga sea instantánea (solo texto). */
const MIN_WALK_MS = 1600;
/** Arcón abierto antes de cerrar la tapa, y el festejo antes de irse. */
const OPEN_MS = 380;
const CHEER_MS = 700;
const FADE_MS = 400;

type Phase = 'line' | 'deliver' | 'cheer' | 'fail';

interface Worker {
  chapterId: string;
  voice: string;
  phase: Phase;
  /** Cuándo pasó al frente de la fila (empieza a caminar). */
  startedAt: number | null;
  /** Cómo terminó su descarga; null mientras baja. */
  result: 'ok' | 'failed' | null;
  /** Lo caminado, de 0 (inicio) a 1 (el arcón). */
  shown: number;
}

/**
 * Las descargas del atril, en escena (frontend §2.4): al pie del atril aparece un arcón;
 * por cada capítulo en cola, un aprendiz con su pergamino espera en fila a la izquierda.
 * El primero camina al arcón según el avance real (nunca más rápido que MIN_WALK_MS); al
 * llegar, el arcón se abre, guarda el pergamino y se cierra ("clonc"), y el aprendiz
 * festeja y se va. Si la descarga falla, se desvanece sin entregarlo.
 *
 * Solo en el Scriptorium con movimiento completo. En el celular el pie del atril no se ve:
 * la escena va en una franja sobre la lista de capítulos (`.dl-strip-slot`), solo
 * mientras algo baja. En el Clásico o con movimiento reducido, se oye el "clonc" suave al
 * terminar cada descarga y nada más.
 */
export function DownloadCrew({
  chapterIds,
  voiceFor,
  scene,
}: {
  /** Los capítulos de este libro: las descargas de otros no salen aquí. */
  chapterIds: string[];
  voiceFor: (chapterId: string) => string | null;
  /** El atril: la escena se dibuja al pie de `.lectern-stand` o en `.dl-strip-slot`. */
  scene: RefObject<HTMLDivElement | null>;
}) {
  const { world, reducedMotion } = useTheme();
  const animated = hasScenes(world) && !reducedMotion;
  const active = useDownloads((s) => s.active);
  const ids = useMemo(() => new Set(chapterIds), [chapterIds]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const voices = useRef(voiceFor);
  useEffect(() => {
    voices.current = voiceFor;
  });

  // Cada capítulo que entra en la cola suma un aprendiz; al salir, se anota cómo terminó.
  useEffect(() => {
    setWorkers((current) => {
      let changed = false;
      const next = current.map((w) => {
        if (w.result || active[w.chapterId] !== undefined) return w;
        changed = true;
        return {
          ...w,
          result: downloads.chapter(w.chapterId) ? ('ok' as const) : ('failed' as const),
        };
      });
      for (const id of Object.keys(active)) {
        if (!ids.has(id) || next.some((w) => w.chapterId === id && !w.result)) continue;
        changed = true;
        next.push({
          chapterId: id,
          voice: voices.current(id) ?? '',
          phase: 'line',
          startedAt: null,
          result: null,
          shown: 0,
        });
      }
      return changed ? next : current;
    });
  }, [active, ids]);

  // El arcón se queda un momento después del último, y se desvanece.
  const busy = animated && workers.length > 0;
  const [chestShown, setChestShown] = useState(false);
  useEffect(() => {
    if (busy) {
      setChestShown(true);
      return;
    }
    const timer = window.setTimeout(() => setChestShown(false), FADE_MS + 200);
    return () => window.clearTimeout(timer);
  }, [busy]);

  // Sin escena: solo el sonido al terminar bien, y los aprendices se despiden al instante.
  const visible = useStage(scene, animated && (busy || chestShown));
  const staged = animated && visible !== null;
  useEffect(() => {
    if (staged) return;
    const done = workers.filter((w) => w.result);
    if (done.length === 0) return;
    if (done.some((w) => w.result === 'ok')) Sound.play('chest-soft');
    setWorkers((current) => current.filter((w) => !w.result));
  }, [staged, workers]);

  // La escena: el primero de la fila camina, entrega y se va; luego, el siguiente.
  const front = workers[0];
  useEffect(() => {
    if (!staged || !front) return;
    const now = performance.now();
    const update = (patch: Partial<Worker>) =>
      setWorkers((current) =>
        current[0]?.chapterId === front.chapterId
          ? [{ ...current[0], ...patch }, ...current.slice(1)]
          : current,
      );
    if (front.phase === 'line') {
      if (front.startedAt === null) {
        update({ startedAt: now });
        return;
      }
      if (front.result === 'failed') {
        update({ phase: 'fail' });
        return;
      }
      const timer = window.setInterval(() => {
        const real = front.result === 'ok' ? 1 : (downloads.state.active[front.chapterId] ?? 0);
        const walked = Math.min(real, (performance.now() - front.startedAt!) / MIN_WALK_MS);
        if (front.result === 'ok' && walked >= 1) update({ shown: 1, phase: 'deliver' });
        else if (walked > front.shown) update({ shown: walked });
      }, 100);
      return () => window.clearInterval(timer);
    }
    if (front.phase === 'deliver') {
      const timer = window.setTimeout(() => {
        Sound.play('chest');
        update({ phase: 'cheer' });
      }, OPEN_MS);
      return () => window.clearTimeout(timer);
    }
    // Festeja (o se desvanece) y deja su lugar al siguiente.
    const timer = window.setTimeout(
      () => setWorkers((current) => current.slice(1)),
      front.phase === 'cheer' ? CHEER_MS : FADE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [staged, front]);

  const chestSvg = useMemo(() => Pixel.downloadChest(), []);
  if (!visible || (!chestShown && workers.length === 0)) return null;

  // Coordenadas en el escenario: la fila empieza a la izquierda del pie (o del borde, en
  // la franja) y termina en el arcón, a su derecha. Todo en múltiplos de SCALE para que el arte no se deforme.
  const snap = (x: number) => Math.round(x / SCALE) * SCALE;
  const chestX = snap(visible.right + GAP);
  const startX = snap(visible.left - CARRIER - GAP);
  const endX = chestX - CARRIER + 2 * SCALE;
  const open = front?.phase === 'deliver';
  return createPortal(
    <div
      className={`dl-floor${visible.strip ? ' is-strip' : ''}`}
      style={{ height: CHEST_H }}
      aria-hidden="true"
    >
      <div
        className={`dl-chest${open ? ' is-open' : ''}${busy ? '' : ' is-leaving'}`}
        style={{ left: chestX, width: CHEST_W, height: CHEST_H }}
      >
        <PixelArt svg={chestSvg} />
      </div>
      {workers.map((worker, index) => {
        const x =
          index === 0
            ? snap(startX + (endX - startX) * worker.shown)
            : startX - index * (CARRIER + GAP);
        return (
          <Carrier
            key={worker.chapterId}
            voice={worker.voice}
            phase={index === 0 ? worker.phase : 'line'}
            walking={index === 0 && worker.phase === 'line' && worker.startedAt !== null}
            x={x}
            hidden={x < -CARRIER}
          />
        );
      })}
    </div>,
    visible.target,
  );
}

function Carrier({
  voice,
  phase,
  walking,
  x,
  hidden,
}: {
  voice: string;
  phase: Phase;
  walking: boolean;
  x: number;
  hidden: boolean;
}) {
  const svg = useMemo(() => Pixel.scrollCarrier(voice), [voice]);
  return (
    <div
      className={`dl-carrier is-${phase}${walking ? ' is-walking' : ''}${hidden ? ' is-hidden' : ''}`}
      style={{ transform: `translateX(${x}px)`, width: CARRIER, height: CARRIER }}
    >
      <PixelArt svg={svg} />
    </div>
  );
}

interface Stage {
  /** Dónde se dibuja: el atril (sobre el suelo) o la franja del celular. */
  target: HTMLElement;
  strip: boolean;
  /** Los bordes del pie del atril (en la franja, un pie imaginario que deja sitio a la fila). */
  left: number;
  right: number;
}

/**
 * El escenario: el pie del atril, si se ve; si no (el celular), la franja sobre la lista.
 * Null si no hay ninguno o si no hace falta medir.
 */
function useStage(scene: RefObject<HTMLDivElement | null>, enabled: boolean) {
  const [stage, setStage] = useState<Stage | null>(null);
  useLayoutEffect(() => {
    const root = scene.current;
    const stand = root?.querySelector<HTMLElement>('.lectern-stand');
    const slot = root?.querySelector<HTMLElement>('.dl-strip-slot');
    if (!enabled || !root || !stand) {
      setStage(null);
      return;
    }
    const measure = () => {
      const r = stand.getBoundingClientRect();
      if (r.width > 0) {
        const parent = root.getBoundingClientRect();
        setStage({
          target: root,
          strip: false,
          left: r.left - parent.left,
          right: r.right - parent.left,
        });
        return;
      }
      const width = slot?.getBoundingClientRect().width ?? 0;
      if (!slot || width === 0) {
        setStage(null);
        return;
      }
      // Lugar para dos que esperan a la izquierda y el arcón contra el borde derecho.
      const start = GAP + 2 * (CARRIER + GAP);
      setStage({
        target: slot,
        strip: true,
        left: start + CARRIER + GAP,
        right: width - CHEST_W - 2 * GAP,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stand);
    if (slot) observer.observe(slot);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [scene, enabled]);
  return stage;
}
