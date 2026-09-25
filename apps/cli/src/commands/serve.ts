import { createReadStream, existsSync, readdirSync, statSync, type ReadStream } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { PIPELINE_VERSION } from '@lectio/epub-pipeline';
import { NarrationQueue, RequestError } from '../server/jobs.js';
import { voiceSample } from '../server/samples.js';
import { findProfile, profilesFor, resolveVoice } from '../tts/voices.js';
import { style, userPath } from '../ui/terminal.js';
import { loadAudioIndex } from '../web/audio-index.js';

/**
 * Servidor local de Lectio: sirve out/ (con peticiones Range, sin las que el navegador no
 * puede adelantar un MP3) y una API mínima para que el reproductor genere audio con la
 * voz elegida, sin comandos (docs/lectio-frontend.md §6.3). Solo escucha en 127.0.0.1.
 *
 *   GET  /api/voices?lang=es                  perfiles de voz del idioma
 *   GET  /api/voices/:voz/sample              muestra de unos 5 s (MP3)
 *   GET  /api/books/:libro/audio              audio generado, por capítulo y voz
 *   POST /api/books/:libro/chapters/:n/audio  { voice, prefetch } → trabajo en cola
 *   GET  /api/jobs?book=:libro                estado de los trabajos
 */
export async function serve(folder = 'out', options: { port?: string } = {}): Promise<void> {
  const root = userPath(folder);
  const port = Number(options.port ?? 4173);
  const queue = new NarrationQueue(root);
  const origins = new Set([`http://localhost:${port}`, `http://127.0.0.1:${port}`]);

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const handle = url.pathname.startsWith('/api/')
      ? api(request, response, url)
      : Promise.resolve(staticFile(request, response, url, root));
    handle.catch((error: unknown) => {
      const status = error instanceof RequestError ? error.status : 500;
      if (status === 500) console.error(style.red(String(error)));
      if (!response.headersSent) json(response, status, { error: message(error) });
      else response.destroy();
    });
  });

  async function api(request: IncomingMessage, response: ServerResponse, url: URL) {
    // Una página de otro sitio no puede usar esta API: la narración gasta la cuota de Edge.
    const origin = request.headers.origin;
    if (origin && !origins.has(origin)) throw new RequestError(403, 'Origen no permitido.');
    const parts = url.pathname.split('/').filter(Boolean).slice(1).map(decodeURIComponent);

    if (request.method === 'GET' && parts[0] === 'voices' && parts.length === 1) {
      const voices = profilesFor(url.searchParams.get('lang') ?? 'es');
      return json(response, 200, {
        voices: voices.map(({ id, name, description }) => ({ id, name, description })),
      });
    }
    if (request.method === 'GET' && parts[0] === 'voices' && parts[2] === 'sample') {
      const profile = findProfile(parts[1] ?? '');
      if (!profile) throw new RequestError(404, 'No existe esa voz.');
      const audio = await voiceSample(root, resolveVoice(profile.id, profile.language));
      response.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audio.length,
        'Cache-Control': 'max-age=3600',
      });
      return response.end(audio);
    }
    if (parts[0] === 'books' && parts[1]) {
      const slug = parts[1];
      if (!/^[a-z0-9-]+$/.test(slug)) throw new RequestError(400, 'Libro no válido.');
      const bookDir = join(root, slug);
      if (request.method === 'GET' && parts[2] === 'audio' && parts.length === 3) {
        const index = await loadAudioIndex(PIPELINE_VERSION, bookDir, join(bookDir, 'audio'));
        return json(response, 200, { chapters: Object.fromEntries(index) });
      }
      if (request.method === 'POST' && parts[2] === 'chapters' && parts[4] === 'audio') {
        const chapter = Number(parts[3]);
        const body = (await readJson(request)) as { voice?: unknown; prefetch?: unknown };
        if (!Number.isInteger(chapter)) throw new RequestError(400, 'Capítulo no válido.');
        // Solo perfiles: la API no acepta nombres de voz arbitrarios.
        const profile = typeof body.voice === 'string' ? findProfile(body.voice) : undefined;
        if (!profile) throw new RequestError(400, 'Voz no válida.');
        const job = await queue.request(slug, chapter, profile.id, body.prefetch === true);
        return json(response, job.status === 'done' ? 200 : 202, { job });
      }
    }
    if (request.method === 'GET' && parts[0] === 'jobs' && parts.length === 1) {
      return json(response, 200, { jobs: queue.list(url.searchParams.get('book') ?? undefined) });
    }
    throw new RequestError(404, 'Ruta no encontrada.');
  }

  server
    .on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        console.error(
          style.red(
            `El puerto ${port} ya está en uso: probablemente el servidor ya está corriendo.`,
          ),
        );
        console.error(
          `Abre http://localhost:${port}/ o usa otro puerto: pnpm serve --port ${port + 1}`,
        );
        process.exit(1);
      }
      throw error;
    })
    .listen(port, '127.0.0.1', () => {
      console.log(
        `Lectio en ${style.blue(`http://localhost:${port}/`)} ${style.gray(`(${root})`)}`,
      );
      const pages = findPages(root).slice(0, 20);
      if (pages.length) {
        console.log(
          `\nPáginas:\n${pages.map((p) => `  http://localhost:${port}/${p}`).join('\n')}`,
        );
      }
      console.log(
        style.gray('\nDesde el reproductor se puede cambiar de voz y generar el audio que falte.'),
      );
    });
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.m3u': 'audio/x-mpegurl',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function staticFile(request: IncomingMessage, response: ServerResponse, url: URL, root: string) {
  let path = normalize(join(root, decodeURIComponent(url.pathname)));
  // Nada fuera de la carpeta servida, ni la carpeta interna (.lectio).
  if ((path !== root && !path.startsWith(root + sep)) || path.includes(`${sep}.lectio`)) {
    return send(response, 403, 'Prohibido');
  }
  if (url.pathname === '/favicon.ico') {
    response.writeHead(204);
    return response.end();
  }
  if (existsSync(path) && statSync(path).isDirectory()) {
    if (!existsSync(join(path, 'index.html'))) return listing(response, path, url.pathname);
    path = join(path, 'index.html');
  }
  if (!existsSync(path)) return send(response, 404, 'No encontrado');

  const size = statSync(path).size;
  const headers = {
    'Content-Type': TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    // Los previews y el audio se regeneran seguido: que el navegador no use una versión vieja.
    'Cache-Control': 'no-cache',
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range ?? '');
  if (range) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start > end || start >= size) {
      response.writeHead(416, { 'Content-Range': `bytes */${size}` });
      return response.end();
    }
    response.writeHead(206, {
      ...headers,
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': end - start + 1,
    });
    return stream(createReadStream(path, { start, end }), response);
  }
  response.writeHead(200, { ...headers, 'Content-Length': size });
  stream(createReadStream(path), response);
}

/** Previews y páginas generadas, para mostrar sus enlaces al arrancar. */
function findPages(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const pages = existsSync(join(dir, 'index.html')) ? [''] : [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const sub = join(dir, entry.name);
    if (existsSync(join(sub, 'preview.html'))) pages.push(`${entry.name}/preview.html`);
    else if (existsSync(join(sub, 'index.html'))) pages.push(`${entry.name}/`);
  }
  return pages;
}

function listing(response: ServerResponse, dir: string, pathname: string) {
  const base = pathname.endsWith('/') ? pathname : `${pathname}/`;
  const entries = readdirSync(dir, { withFileTypes: true })
    .filter((e) => !e.name.startsWith('.'))
    .sort(
      (a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name),
    );
  const escape = (text: string) =>
    text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  const items = entries
    .map((e) => {
      const href = `${base}${encodeURIComponent(e.name)}${e.isDirectory() ? '/' : ''}`;
      return `<li><a href="${href}">${escape(e.name)}${e.isDirectory() ? '/' : ''}</a></li>`;
    })
    .join('');
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache',
  });
  response.end(`<!doctype html><meta charset="utf-8"><title>Lectio · ${escape(base)}</title>
<style>body{font-family:system-ui,sans-serif;background:#f8f4ec;color:#1d1b18;max-width:40rem;margin:2rem auto;padding:0 1rem}
a{color:#1f3a5f}li{margin:.3rem 0}h1{font-size:1.2rem}</style>
<h1>Lectio · ${escape(base)}</h1><ul>${base !== '/' ? '<li><a href="../">../</a></li>' : ''}${items || '<li>(vacío)</li>'}</ul>`);
}

/**
 * Si el navegador corta la descarga (normal al adelantar un audio), el archivo se cierra:
 * en Windows, un archivo abierto no se puede reemplazar al regenerar el audio.
 */
function stream(file: ReadStream, response: ServerResponse) {
  response.on('close', () => file.destroy());
  file.on('error', () => response.destroy());
  file.pipe(response);
}

/** Cuerpo JSON, como máximo 10 KB. Exigir application/json obliga a un preflight CORS. */
async function readJson(request: IncomingMessage): Promise<unknown> {
  if (!request.headers['content-type']?.startsWith('application/json')) {
    throw new RequestError(415, 'Se espera JSON.');
  }
  let body = '';
  for await (const chunk of request) {
    body += String(chunk);
    if (body.length > 10_240) throw new RequestError(413, 'Cuerpo demasiado grande.');
  }
  try {
    return JSON.parse(body || '{}');
  } catch {
    throw new RequestError(400, 'JSON no válido.');
  }
}

function json(response: ServerResponse, status: number, data: unknown) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(data));
}

function send(response: ServerResponse, status: number, text: string) {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end(text);
}

function message(error: unknown): string {
  return error instanceof RequestError ? error.message : 'Error interno del servidor.';
}
