import { expect, test } from '@playwright/test';
import {
  chapterSnippet,
  controlledByServiceWorker,
  escapeRegExp,
  openLectern,
  publicBook,
  queuedProgress,
  serverProgress,
  signIn,
  type BookInfo,
} from './helpers.js';

/**
 * Lectio sin conexión, de punta a punta (frontend §2.4 y §6.3–6.4): el build real con su
 * Service Worker, la red cortada de verdad (context.setOffline) y la API de desarrollo.
 */
let book: BookInfo;

test.beforeAll(async () => {
  book = await publicBook();
  expect(book.chapters.length).toBeGreaterThanOrEqual(3);
});

test('la app abre sin conexión con la biblioteca de la última visita', async ({
  page,
  context,
}) => {
  await page.goto('/biblioteca');
  await expect(
    page.getByRole('button', { name: new RegExp(`^${escapeRegExp(book.title)}`) }),
  ).toBeVisible();
  await controlledByServiceWorker(page);
  // La caché de TanStack se guarda en IndexedDB cada ~2 s.
  await page.waitForTimeout(2500);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.offline-chip')).toHaveText('Sin conexión');
  // Sin nada descargado, el libro se ve apagado y lo dice.
  await expect(
    page.getByRole('button', {
      name: new RegExp(`${escapeRegExp(book.title)}.*\\(sin conexión\\)$`),
    }),
  ).toBeVisible();
});

test('un capítulo descargado se lee sin conexión; los demás lo explican', async ({
  page,
  context,
}) => {
  const [first, second, third] = book.chapters as [
    BookInfo['chapters'][number],
    BookInfo['chapters'][number],
    BookInfo['chapters'][number],
  ];
  const snippet = await chapterSnippet(second.id);

  await page.goto('/biblioteca');
  await controlledByServiceWorker(page);
  await openLectern(page, book);
  await page
    .getByRole('button', { name: new RegExp(`^${escapeRegExp(second.title)}: descargar`) })
    .click();
  await expect(
    page.getByRole('button', { name: new RegExp(`^${escapeRegExp(second.title)}: descargado`) }),
  ).toBeVisible();

  await context.setOffline(true);
  await page.goto(`/libros/${book.slug}?capitulo=${second.orderIndex}`);
  await expect(page.locator('.prose')).toContainText(snippet);

  // Uno que no está descargado: lo explica y ofrece el descargado más cercano.
  await page.goto(`/libros/${book.slug}?capitulo=${third.orderIndex}`);
  await expect(page.locator('.chapter-offline')).toContainText('no está descargado');
  await page.locator('.chapter-offline button').click();
  await expect(page).toHaveURL(new RegExp(`capitulo=${second.orderIndex}$`));
  await expect(page.locator('.prose')).toContainText(snippet);
  expect(first.id).not.toBe(second.id);
});

test('el progreso hecho sin conexión llega al servidor al volver la red', async ({
  page,
  context,
  request,
}) => {
  const [first, second] = book.chapters as [
    BookInfo['chapters'][number],
    BookInfo['chapters'][number],
  ];
  await page.goto('/biblioteca');
  await controlledByServiceWorker(page);
  const { token } = await signIn(page, request);

  await page.goto(`/libros/${book.slug}?capitulo=${first.orderIndex}`);
  await expect(page.locator('.prose')).toBeVisible();

  // Sin red, se pasa al capítulo siguiente: la posición queda en la cola.
  await context.setOffline(true);
  await page
    .locator('.chapter-nav')
    .getByRole('button', { name: /Siguiente/ })
    .click();
  await expect(page).toHaveURL(new RegExp(`capitulo=${second.orderIndex}$`));
  // La posición se envía como mucho cada 10 s: sin red, a la cola.
  await expect
    .poll(() => queuedProgress(page), { timeout: 20_000 })
    .toContainEqual({ bookId: book.id, chapterId: second.id });
  expect((await serverProgress(request, token, book.id)).chapterId).not.toBe(second.id);

  // Vuelve la red: se envía sola y la cola queda vacía.
  await context.setOffline(false);
  await expect
    .poll(async () => (await serverProgress(request, token, book.id)).chapterId, {
      timeout: 15_000,
    })
    .toBe(second.id);
  await expect.poll(() => queuedProgress(page)).toEqual([]);
});

test('el audio descargado suena sin conexión', async ({ page, context }) => {
  const chapter = book.chapters.find((c) => c.hasAudio);
  test.skip(
    !chapter,
    'La biblioteca pública no tiene audio: cárgala con audio (pnpm seed:public) para esta prueba.',
  );
  await page.goto('/biblioteca');
  await controlledByServiceWorker(page);
  await openLectern(page, book);
  await page
    .getByRole('button', { name: new RegExp(`^${escapeRegExp(chapter!.title)}: descargar con`) })
    .click();
  await expect(
    page.getByRole('button', { name: new RegExp(`^${escapeRegExp(chapter!.title)}: descargado`) }),
  ).toBeVisible({ timeout: 60_000 });

  await context.setOffline(true);
  await page.goto(`/libros/${book.slug}?capitulo=${chapter!.orderIndex}`);
  await page.getByRole('button', { name: 'Reproducir' }).first().click();
  // Suena (el botón pasa a "Pausar") y sigue sonando: el audio sale de la descarga.
  await expect(page.getByRole('button', { name: 'Pausar' }).first()).toBeVisible();
  await page.waitForTimeout(2000);
  await expect(page.getByRole('button', { name: 'Pausar' }).first()).toBeVisible();
});
