import { useState } from 'react';
import { Workbox } from 'workbox-window';
import { create } from 'zustand';
import { Icon } from '../components/art';

/** Cada cuánto se pregunta si hay una versión nueva, con la app abierta. */
const CHECK_EVERY_MS = 60 * 60_000;

const useUpdate = create<{ apply: (() => void) | null }>(() => ({ apply: null }));

/**
 * Registra el Service Worker (solo en el build: en desarrollo no hay). Cuando una versión
 * nueva queda esperando, aparece el aviso; la app nunca se recarga sola (frontend §2.4).
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const wb = new Workbox('/sw.js');
  wb.addEventListener('waiting', () =>
    useUpdate.setState({
      apply: () => {
        // Cuando el worker nuevo toma el control, se recarga con la versión nueva.
        wb.addEventListener('controlling', () => window.location.reload());
        wb.messageSkipWaiting();
      },
    }),
  );
  void wb.register();
  window.setInterval(() => void wb.update(), CHECK_EVERY_MS);
}

/** "Hay una versión nueva" con "Actualizar". Si se cierra, se aplica en la próxima apertura. */
export function UpdateNotice() {
  const apply = useUpdate((s) => s.apply);
  const [later, setLater] = useState(false);
  if (!apply || later) return null;
  return (
    <div className="app-toast" role="status">
      <span>Hay una versión nueva de Lectio.</span>
      <button type="button" className="app-toast-action" onClick={apply}>
        Actualizar
      </button>
      <button
        type="button"
        className="app-toast-close"
        aria-label="Más tarde"
        title="Más tarde"
        onClick={() => setLater(true)}
      >
        <Icon name="close" />
      </button>
    </div>
  );
}
