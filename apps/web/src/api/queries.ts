import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi, useSession } from '../app/context';
import type { ApiClient } from './client';
import { downloads, isUnreachable } from '../pwa/downloads';
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

export type ChapterSummary = Schemas['ChapterSummaryDto'];
export type Chapter = Schemas['ChapterDto'];
export type Position = Schemas['PositionDto'];

/**
 * Un capítulo. La API responde con ETag y `Cache-Control: no-cache`: el navegador guarda
 * la respuesta y la revalida sola (If-None-Match → 304), así que volver a un capítulo no
 * lo descarga de nuevo. Su contenido solo cambia si el libro se reprocesa. Sin red, sale
 * de lo descargado. El lector y el adelanto usan las mismas opciones: si el adelanto
 * quedara en pausa sin red, el lector esperaría por él.
 */
function chapterQuery(api: ApiClient, id: string | null) {
  return {
    queryKey: ['chapter', id],
    queryFn: () =>
      offlineFallback(
        () => api.get<Chapter>(`/api/v1/chapters/${id}`),
        () => downloads.readChapter(id!),
      ),
    // Sin red también se intenta: puede estar descargado.
    networkMode: 'always' as const,
    staleTime: Infinity,
  };
}

export function useChapter(id: string | null) {
  const api = useApi();
  return useQuery({ ...chapterQuery(api, id), enabled: id !== null, gcTime: 10 * 60_000 });
}

/** Adelanta el capítulo siguiente para que pasar de página sea instantáneo. */
export function usePrefetchChapter() {
  const api = useApi();
  const client = useQueryClient();
  return (id: string) => client.prefetchQuery(chapterQuery(api, id));
}

/** Dónde ibas en el libro, según el servidor (solo con sesión; sin ella, en el navegador). */
export function useServerPosition(bookId: string | null) {
  const api = useApi();
  const userId = useUserId();
  return useQuery({
    queryKey: ['progress', bookId, userId],
    queryFn: () => api.get<Position>(`/api/v1/books/${bookId}/progress`),
    enabled: bookId !== null && userId !== null,
    // Siempre fresco al abrir el libro: quizá avanzaste en otro dispositivo.
    staleTime: 0,
  });
}

/**
 * El detalle de un libro (capítulos, progreso, audio por voz). Los públicos se piden por
 * slug; los tuyos, por id. Solo cuando está listo: antes no tiene capítulos.
 */
export function useBookDetail(book: Pick<BookSummary, 'id' | 'isPublic' | 'slug' | 'status'>) {
  const api = useApi();
  const userId = useUserId();
  return useQuery({
    queryKey: [...keys.book(book.id), userId],
    queryFn: () =>
      offlineFallback(
        () =>
          api.get<BookDetail>(
            book.isPublic && book.slug
              ? `/api/v1/books/public/${encodeURIComponent(book.slug)}`
              : `/api/v1/books/${book.id}`,
          ),
        async () => (await downloads.load(), downloads.book(book.id)),
      ),
    networkMode: 'always',
    enabled: book.status === 'ready',
  });
}

/**
 * Pide a la API; si la red falla, usa lo descargado (si lo hay). Así el lector abre sin
 * conexión aunque no haya Service Worker (en desarrollo) o la caché de la visita anterior
 * ya no tenga el libro.
 */
async function offlineFallback<T>(
  fetcher: () => Promise<T>,
  fallback: () => Promise<T | null>,
): Promise<T> {
  try {
    return await fetcher();
  } catch (error) {
    if (!isUnreachable(error)) throw error;
    const saved = await fallback().catch(() => null);
    if (saved) return saved;
    throw error;
  }
}
