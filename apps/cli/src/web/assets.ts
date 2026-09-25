import { readFile } from 'node:fs/promises';

/** Los assets viven en apps/cli/assets: misma profundidad desde src/web y dist/web. */
const ASSETS = new URL('../../assets/', import.meta.url);

/** Módulos compartidos: sistema de temas, motor de pixel art y sonido (docs/lectio-temas.md). */
const SHARED_CSS = ['theme/scriptorium.css'];
const SHARED_JS = ['theme/icons.js', 'theme/theme.js', 'theme/pixel.js', 'theme/sound.js'];

const PAGES = {
  preview: { css: ['preview/preview.css'], js: ['preview/preview.js'] },
  library: { css: ['preview/preview.css', 'library/library.css'], js: ['library/library.js'] },
} as const;

/** Fuentes: Literata (lectura), Atkinson Hyperlegible (interfaz) y Pixelify Sans (títulos pixel). */
export const FONT_LINKS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;1,7..72,400&family=Pixelify+Sans:wght@400;500;600&display=swap">`;

/** CSS y JS de una página, concatenados en orden (la página es un solo archivo autocontenido). */
export async function pageAssets(page: keyof typeof PAGES): Promise<{ css: string; js: string }> {
  const read = (files: readonly string[]) =>
    Promise.all(files.map((file) => readFile(new URL(file, ASSETS), 'utf8')));
  // El CSS de la página va primero: el del tema sobrescribe sus tokens.
  const [pageCss, sharedCss, sharedJs, pageJs] = await Promise.all([
    read(PAGES[page].css),
    read(SHARED_CSS),
    read(SHARED_JS),
    read(PAGES[page].js),
  ]);
  return { css: [...pageCss, ...sharedCss].join('\n'), js: [...sharedJs, ...pageJs].join('\n;\n') };
}

/** JSON seguro dentro de un <script>: "<" escapado para que un texto no pueda cerrar la etiqueta. */
export function embedJson(data: unknown): string {
  const lessThan = String.fromCharCode(92) + 'u003c';
  return JSON.stringify(data).replaceAll('<', lessThan);
}

export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
