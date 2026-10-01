import { API_URL } from './helpers.js';

/**
 * Antes de las pruebas: la API tiene que responder y la biblioteca pública tener al menos
 * un libro listo. Si no, se dice qué levantar en vez de fallar a medio camino.
 */
export default async function globalSetup(): Promise<void> {
  let books: Array<{ slug: string | null; status: string }>;
  try {
    const response = await fetch(`${API_URL}/api/v1/books/public`, {
      signal: AbortSignal.timeout(5000),
    });
    books = (await response.json()) as typeof books;
  } catch {
    throw new Error(
      `La API no responde en ${API_URL}. Levántala antes: pnpm db:up && pnpm dev (desde la raíz).`,
    );
  }
  if (!books.some((b) => b.slug && b.status === 'ready')) {
    throw new Error('La biblioteca pública está vacía: pnpm seed:public --audio none');
  }
}
