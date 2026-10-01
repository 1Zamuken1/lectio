import { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { create } from 'zustand';
import { RasterArt } from '../components/RasterArt';
import { Sound } from '../theme/sound';
import { useTheme } from '../theme/theme';
import { rasterScene, type ScenePiece } from '../theme/world-art';

/** Lo que dura cada mitad del fundido (en library.css, `room-fade-*`). */
export const FADE_MS = 400;
/** La puerta se ve abierta un momento antes de que empiece a oscurecer. */
const DOOR_MS = 150;

/**
 * Paso entre las salas: la puerta se abre, la pantalla funde, cambia la ruta y la otra
 * sala aparece desde el fundido. Vive fuera de las salas porque cruza el cambio de ruta.
 * En un mundo con tronco (el Bosque), en vez del fundido la vista sube o baja por el árbol.
 */
interface RoomDoor {
  phase: 'idle' | 'opening' | 'out' | 'in';
  /** La ruta a la que se va. */
  to: string | null;
}

export const useRoomDoor = create<RoomDoor>(() => ({ phase: 'idle', to: null }));

/** Devuelve `go(ruta)`: cruza la puerta hacia esa sala (directo con movimiento reducido). */
export function useGoThroughDoor() {
  const navigate = useNavigate();
  return useCallback(
    (to: string) => {
      if (useRoomDoor.getState().phase !== 'idle') return;
      Sound.play('door');
      if (document.documentElement.dataset.motion !== 'full') {
        void navigate(to);
        return;
      }
      const set = useRoomDoor.setState;
      set({ phase: 'opening', to });
      window.setTimeout(() => set({ phase: 'out' }), DOOR_MS);
      window.setTimeout(() => {
        void navigate(to);
        set({ phase: 'in' });
        window.setTimeout(() => set({ phase: 'idle', to: null }), FADE_MS);
      }, DOOR_MS + FADE_MS);
    },
    [navigate],
  );
}

/** La sala de cada ruta, para saber hacia dónde se recorre el árbol. */
const ROOM_OF: Record<string, 'monastery' | 'study'> = {
  '/biblioteca': 'monastery',
  '/estudio': 'study',
};

/** El velo del fundido (lo pone el layout, encima de todo), o el paso por el árbol. */
export function RoomFade() {
  const phase = useRoomDoor((s) => s.phase);
  const to = useRoomDoor((s) => s.to);
  const { world } = useTheme();
  const { pathname } = useLocation();
  // De dónde se sale: la ruta al empezar (durante el paso cambia por debajo).
  const [from, setFrom] = useState<string | null>(null);
  if (phase === 'out' && from === null) setFrom(pathname);
  if (phase === 'idle' && from !== null) setFrom(null);
  if (phase !== 'out' && phase !== 'in') return null;
  const trunk = rasterScene(world, 'trunk');
  const a = ROOM_OF[from ?? pathname];
  const b = to ? ROOM_OF[to] : undefined;
  if (trunk && a && b && a !== b) return <RoomPassage world={world} from={a} to={b} />;
  return <div className={`room-fade ${phase}`} aria-hidden="true" />;
}

/**
 * El paso por el árbol: una tira con las dos salas y el tronco entre ellas (tu estudio
 * arriba, la biblioteca abajo) que se desliza en pasos, en lo que dura el fundido entero.
 */
function RoomPassage({
  world,
  from,
  to,
}: {
  world: Parameters<typeof rasterScene>[0];
  from: 'monastery' | 'study';
  to: 'monastery' | 'study';
}) {
  const strip: ScenePiece[] = ['study', 'trunk', 'monastery'];
  return (
    <div
      className={`room-passage ${to === 'study' ? 'going-up' : 'going-down'}`}
      aria-hidden="true"
      data-from={from}
    >
      <div className="room-passage-strip">
        {strip.map((piece) => {
          const scene = rasterScene(world, piece);
          return scene ? (
            <RasterArt key={piece} className="room-passage-frame" scene={scene} still />
          ) : null;
        })}
      </div>
    </div>
  );
}
