import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
    // Mientras el worker prepara algún libro, se consulta cada 2 s (frontend §7).
    refetchInterval: (query) => (query.state.data?.some(isPreparing) ? 2000 : false),
  });
}

/** El worker aún no termina de leer el EPUB. */
export function isPreparing(book: BookSummary): boolean {
  return book.status === 'pending' || book.status === 'processing';
}

/** Sube un EPUB (202: queda en pending) y refresca la biblioteca para que aparezca. */
export function useUploadBook() {
  const api = useApi();
  const client = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api.post<Schemas['UploadResponseDto']>('/api/v1/books', form);
    },
    onSettled: () => client.invalidateQueries({ queryKey: keys.library(userId ?? '') }),
  });
}
