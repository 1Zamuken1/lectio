import { useQuery } from '@tanstack/react-query';
import { useApi, useSession } from '../app/context';
import type { components } from './schema';

export type Schemas = components['schemas'];
export type BookSummary = Schemas['BookSummaryDto'];
export type BookDetail = Schemas['BookDetailDto'];

/**
 * Claves de caché. El catálogo público y la biblioteca dependen de quién mira (el progreso
 * es del usuario), así que llevan el id de la sesión: al entrar o salir no se mezclan.
 */
export const keys = {
  publicBooks: (userId: string | null) => ['books', 'public', userId] as const,
  library: (userId: string) => ['books', 'mine', userId] as const,
  book: (id: string) => ['book', id] as const,
};

function useUserId(): string | null {
  const { state } = useSession();
  return state.status === 'authenticated' ? state.user.id : null;
}

export function usePublicBooks() {
  const api = useApi();
  const { state } = useSession();
  const userId = useUserId();
  return useQuery({
    queryKey: keys.publicBooks(userId),
    queryFn: () => api.get<BookSummary[]>('/api/v1/books/public'),
    // Hasta saber si hay sesión: evita pedir dos veces (anónimo y luego con usuario).
    enabled: state.status !== 'unknown',
  });
}

export function useLibrary() {
  const api = useApi();
  const userId = useUserId();
  return useQuery({
    queryKey: keys.library(userId ?? ''),
    queryFn: () => api.get<BookSummary[]>('/api/v1/books'),
    enabled: userId !== null,
  });
}
