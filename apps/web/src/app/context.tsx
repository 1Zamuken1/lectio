import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { ApiClient, ApiError } from '../api/client';
import { Session, rememberInBrowser, type SessionState } from '../api/session';
import { downloads } from '../pwa/downloads';
import { persistOptions } from '../pwa/persist';
import { PlayerController, type PlayerState } from '../player/controller';
import { ProgressSync } from '../reader/position';
import { useStore } from 'zustand';

interface AppServices {
  api: ApiClient;
  session: Session;
  /** Dónde vas en cada libro (navegador y servidor). */
  progress: ProgressSync;
  /** El único <audio> de la app: sigue sonando al cambiar de pantalla. */
  player: PlayerController;
}

const AppContext = createContext<AppServices | null>(null);

/** Una sesión por pestaña, coordinada con las demás (Web Locks + BroadcastChannel). */
export function createServices(): AppServices {
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel('lectio:session') : undefined;
  const locks = navigator.locks
    ? { request: <T,>(name: string, run: () => Promise<T>) => navigator.locks.request(name, run) }
    : undefined;
  const session = new Session({
    fetch: (...args) => fetch(...args),
    locks,
    channel,
    remember: rememberInBrowser,
  });
  const api = new ApiClient(session);
  const authenticated = () => session.state.status === 'authenticated';
  const userId = () => (session.state.status === 'authenticated' ? session.state.user.id : null);
  const progress = new ProgressSync(api, queryClient, userId);
  progress.install();
  // Al entrar (o al saberse que la sesión sigue) sale el progreso que quedó sin enviar.
  session.subscribe((state) => {
    if (state.status === 'authenticated') void progress.sync();
  });
  const player = new PlayerController(api, queryClient, progress, authenticated);
  // En desarrollo, a mano desde la consola: window.lectio.player.state
  if (import.meta.env.DEV) {
    Object.assign(window, { lectio: { player, progress, session, api, downloads } });
  }
  return { session, api, progress, player };
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Un 4xx no mejora reintentando (403, 404); un corte de red o un 5xx, sí.
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
      refetchOnWindowFocus: false,
    },
  },
});

/** Lo de la última visita, en IndexedDB: sin conexión, las salas se ven igual (persist.ts). */
const persisted = persistOptions();

export function AppProvider({
  services,
  children,
}: {
  services: AppServices;
  children: ReactNode;
}) {
  return (
    <AppContext.Provider value={services}>
      {persisted ? (
        <PersistQueryClientProvider client={queryClient} persistOptions={persisted}>
          {children}
        </PersistQueryClientProvider>
      ) : (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      )}
    </AppContext.Provider>
  );
}

function useServices(): AppServices {
  const services = useContext(AppContext);
  if (!services) throw new Error('Falta <AppProvider>');
  return services;
}

export const useApi = () => useServices().api;
export const useProgress = () => useServices().progress;
export const usePlayer = () => useServices().player;

/** Una parte del estado del reproductor (se vuelve a pintar solo si cambia). */
export function usePlayerState<T>(select: (state: PlayerState) => T): T {
  return useStore(useServices().player.store, select);
}

export function useSession(): { state: SessionState; session: Session } {
  const { session } = useServices();
  const state = useSyncExternalStore(
    (listener) => session.subscribe(listener),
    () => session.state,
  );
  return { state, session };
}
