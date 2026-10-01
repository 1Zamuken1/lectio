import { useEffect, useRef } from 'react';
import { H, W, type Mode, type Pix, type RasterScene } from '../theme/bosque-scenes';
import { useTheme } from '../theme/theme';

/** La base de cada escena, una vez por modo (dibujarla cuesta unos cientos de ms). */
const bases = new WeakMap<RasterScene, Partial<Record<Mode, Pix>>>();

export function sceneBase(scene: RasterScene, mode: Mode): Pix {
  let byMode = bases.get(scene);
  if (!byMode) bases.set(scene, (byMode = {}));
  return (byMode[mode] ??= scene.base(mode));
}

/** Cada cuánto se repinta lo que se mueve: en pasos, como los sprites de consola. */
const STEP_MS = 125;

/**
 * Una escena de pixel art en lienzo (los mundos que no usan SVG, como el Bosque): ocupa su
 * caja recortándose como una imagen de fondo (`object-fit: cover`, centrada en su
 * `focus`). Lo que se mueve se repinta en pasos; con movimiento reducido, con la pestaña
 * oculta o con `still`, queda quieta.
 */
export function RasterArt({
  scene,
  className,
  still = false,
}: {
  scene: RasterScene;
  className?: string;
  still?: boolean;
}) {
  const { night, reducedMotion } = useTheme();
  const mode: Mode = night ? 'night' : 'day';
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    const base = sceneBase(scene, mode);
    const paint = (p: Pix) => context.putImageData(new ImageData(p.d, p.w, p.h), 0, 0);
    const frame = scene.frame;
    if (!frame || still || reducedMotion) {
      paint(frame && !still ? frame(base, mode, 0) : base);
      return;
    }
    let raf = 0;
    let last = -Infinity;
    const loop = (now: number) => {
      if (now - last >= STEP_MS && !document.hidden) {
        last = now;
        paint(frame(base, mode, now / 1000));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [scene, mode, reducedMotion, still]);

  return (
    <div className={className} aria-hidden="true">
      <canvas
        ref={canvas}
        className="px-raster"
        width={W}
        height={H}
        style={{ objectPosition: `${scene.focus[0] * 100}% ${scene.focus[1] * 100}%` }}
      />
    </div>
  );
}
