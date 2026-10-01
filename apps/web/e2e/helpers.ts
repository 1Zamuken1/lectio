import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { JSDOM } from 'jsdom';

/** La API de desarrollo; el build de las pruebas la usa por el proxy de `vite preview`. */
export const API_URL = process.env.LECTIO_API_URL ?? 'http://localhost:3000';

/** Las cuentas que crean las pruebas: el teardown borra las que calcen (LIKE de SQL). */
export const E2E_EMAIL_PATTERN = 'e2e-%@lectio.test';
/** La misma contraseña que los tests de integración de la API (test/helpers/test-app.ts). */
export const PASSWORD = 'una frase larga y segura';

export interface ChapterInfo {
  id: string;
  orderIndex: number;
  title: string;
  /** Tiene audio listo con alguna voz. */
  hasAudio: boolean;
}

export interface BookInfo {
  id: string;
  slug: string;
  title: string;
  author: string;
  /** Los capítulos narrativos, en orden. */
  chapters: ChapterInfo[];
}

/** El primer libro público listo, con sus capítulos narrativos. */
export async function publicBook(): Promise<BookInfo> {
  const list = (await (await fetch(`${API_URL}/api/v1/books/public`)).json()) as Array<{
    slug: string | null;
    status: string;
  }>;
  const slug = list.find((b) => b.slug && b.status === 'ready')!.slug!;
  const detail = (await (await fetch(`${API_URL}/api/v1/books/public/${slug}`)).json()) as {
    id: string;
    title: string | null;
    author: string | null;
    chapters: Array<{
      id: string;
      orderIndex: number;
      title: string | null;
      kind: string;
      audio: Array<{ status: string }>;
    }>;
  };
  return {
    id: detail.id,
    slug,
    title: detail.title ?? 'Sin título',
    author: detail.author ?? '',
    chapters: detail.chapters
      .filter((c) => c.kind === 'narrative')
      .map((c) => ({
        id: c.id,
        orderIndex: c.orderIndex,
        title: c.title ?? `Capítulo ${c.orderIndex + 1}`,
        hasAudio: c.audio.some((a) => a.status === 'ready'),
      })),
  };
}

/** Un trozo del texto del capítulo (de su primer párrafo largo), para buscarlo en pantalla. */
export async function chapterSnippet(chapterId: string): Promise<string> {
  const chapter = (await (await fetch(`${API_URL}/api/v1/chapters/${chapterId}`)).json()) as {
    contentHtml: string;
  };
  const doc = new JSDOM(chapter.contentHtml).window.document;
  const paragraph = [...doc.querySelectorAll('p')].find(
    (p) => (p.textContent ?? '').trim().length > 60,
  );
  return (paragraph?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
}

/** Espera a que el Service Worker controle la página (la primera visita lo instala). */
export async function controlledByServiceWorker(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  if (!(await page.evaluate(() => navigator.serviceWorker.controller !== null))) {
    await page.reload();
  }
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);
}

/** Abre la ficha del libro en el atril (el lomo en la estantería). */
export async function openLectern(page: Page, book: BookInfo): Promise<void> {
  await page.getByRole('button', { name: new RegExp(`^${escapeRegExp(book.title)}`) }).click();
  await expect(page.getByRole('complementary', { name: `Ficha de ${book.title}` })).toBeVisible();
}

/**
 * Crea una cuenta de prueba, entra con ella por el formulario de la app y devuelve un
 * token para consultar la API desde la prueba. La API limita a 5 por minuto el registro y
 * el login: aquí se usa un registro y dos logins.
 */
export async function signIn(
  page: Page,
  request: APIRequestContext,
): Promise<{ email: string; token: string }> {
  const email = `e2e-${Date.now()}-${Math.round(Math.random() * 1e6)}@lectio.test`;
  const created = await request.post(`${API_URL}/api/v1/auth/register`, {
    data: { email, password: PASSWORD },
  });
  expect(created.ok()).toBe(true);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.locator('.scroll-form input[name="email"]').fill(email);
  await page.locator('.scroll-form input[name="password"]').fill(PASSWORD);
  await page.locator('.scroll-form button[type="submit"]').click();
  await expect(page.getByRole('button', { name: 'Salir' })).toBeVisible();
  const login = await request.post(`${API_URL}/api/v1/auth/login`, {
    data: { email, password: PASSWORD },
  });
  expect(login.ok()).toBe(true);
  const { accessToken } = (await login.json()) as { accessToken: string };
  return { email, token: accessToken };
}

/** El progreso de la cuenta en el libro, según el servidor. */
export async function serverProgress(
  request: APIRequestContext,
  token: string,
  bookId: string,
): Promise<{ chapterId: string | null; sentenceIndex: number }> {
  const response = await request.get(`${API_URL}/api/v1/books/${bookId}/progress`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { chapterId: string | null; sentenceIndex: number };
}

/** Lo que espera en la cola de progreso sin conexión (IndexedDB, store `progress`). */
export function queuedProgress(page: Page): Promise<Array<{ bookId: string; chapterId: string }>> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('lectio');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const all = db.transaction('progress').objectStore('progress').getAll();
          all.onsuccess = () => {
            resolve(
              (all.result as Array<{ bookId: string; position: { chapterId: string } }>).map(
                (e) => ({ bookId: e.bookId, chapterId: e.position.chapterId }),
              ),
            );
            db.close();
          };
        };
      }),
  );
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
