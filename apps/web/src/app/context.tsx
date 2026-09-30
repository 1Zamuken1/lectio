import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { ApiClient, ApiError } from '../api/client';
import { Session, type SessionState } from '../api/session';

interface AppServices {
  api: ApiClient;
  session: Session;
}

const AppContext = createContext<AppServices | null>(null);

/** Una sesión por pestaña, coordinada con las demás (Web Locks + BroadcastChannel). */
export function createServices(): AppServices {
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel('lectio:session') : undefined;
  const locks = navigator.locks
    ? { request: <T,>(name: string, run: () => Promise<T>) => navigator.locks.request(name, run) }
    : undefined;
  const session = new Session({ fetch: (...args) => fetch(...args), locks, channel });
  return { session, api: new ApiClient(session) };
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

export function AppProvider({
  services,
  children,
}: {
  services: AppServices;
  children: ReactNode;
}) {
  return (
    <AppContext.Provider value={services}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </AppContext.Provider>
  );
}

function useServices(): AppServices {
  const services = useContext(AppContext);
  if (!services) throw new Error('Falta <AppProvider>');
  return services;
}

export const useApi = () => useServices().api;

export function useSession(): { state: SessionState; session: Session } {
  const { session } = useServices();
  const state = useSyncExternalStore(
    (listener) => session.subscribe(listener),
    () => session.state,
  );
  return { state, session };
}
