import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { create } from 'zustand';
import { Sound } from '../theme/sound';

/** Lo que dura cada mitad del fundido (en library.css, `room-fade-*`). */
export const FADE_MS = 400;
/** La puerta se ve abierta un momento antes de que empiece a oscurecer. */
const DOOR_MS = 150;

/**
 * Paso entre las salas: la puerta se abre, la pantalla funde, cambia la ruta y la otra
 * sala aparece desde el fundido. Vive fuera de las salas porque cruza el cambio de ruta.
 */
interface RoomDoor {
  phase: 'idle' | 'opening' | 'out' | 'in';
}

export const useRoomDoor = create<RoomDoor>(() => ({ phase: 'idle' }));

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
      set({ phase: 'opening' });
      window.setTimeout(() => set({ phase: 'out' }), DOOR_MS);
      window.setTimeout(() => {
        void navigate(to);
        set({ phase: 'in' });
        window.setTimeout(() => set({ phase: 'idle' }), FADE_MS);
      }, DOOR_MS + FADE_MS);
    },
    [navigate],
  );
}

/** El velo del fundido (lo pone el layout, encima de todo). */
export function RoomFade() {
  const phase = useRoomDoor((s) => s.phase);
  if (phase !== 'out' && phase !== 'in') return null;
  return <div className={`room-fade ${phase}`} aria-hidden="true" />;
}
