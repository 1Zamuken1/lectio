// Servidor estático mínimo para revisar out/ en el navegador: pnpm serve [carpeta] [puerto]
//
// Soporta peticiones Range (206 Partial Content): sin ellas el navegador no puede
// adelantar ni retroceder dentro de un MP3 (docs/lectio-frontend.md §6.3). El servidor
// de Python (http.server) no las soporta. Solo escucha en 127.0.0.1.

import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(process.argv[2] ?? 'out');
const port = Number(process.argv[3] ?? 4173);
const TYPES = {
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

createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  let path = normalize(join(root, decodeURIComponent(url.pathname)));
  // Nada fuera de la carpeta servida.
  if (path !== root && !path.startsWith(root + sep)) return send(response, 403, 'Prohibido');
  if (url.pathname === '/favicon.ico') {
    response.writeHead(204);
    return response.end();
  }
  if (existsSync(path) && statSync(path).isDirectory()) {
    // Sin index.html, un listado navegable (antes, la raíz de out/ respondía 404).
    if (!existsSync(join(path, 'index.html'))) return listing(response, path, url.pathname);
    path = join(path, 'index.html');
  }
  if (!existsSync(path)) return send(response, 404, 'No encontrado');

  const size = statSync(path).size;
  const headers = {
    'Content-Type': TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    // Los previews se regeneran seguido: que el navegador no muestre una versión vieja.
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
})
  .on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `El puerto ${port} ya está en uso: probablemente el servidor ya está corriendo.`,
      );
      console.error(`Abre http://localhost:${port}/ o usa otro puerto: pnpm serve out ${port + 1}`);
      process.exit(1);
    }
    throw error;
  })
  .listen(port, '127.0.0.1', () => {
    console.log(`Sirviendo ${root} en http://localhost:${port}/\n`);
    const pages = findPages(root).slice(0, 20);
    if (pages.length)
      console.log(
        `Páginas disponibles:\n${pages.map((p) => `  http://localhost:${port}/${p}`).join('\n')}`,
      );
  });

/** Previews y páginas de voces generadas, para mostrar sus enlaces al arrancar. */
function findPages(dir, prefix = '') {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory()) return [];
    const sub = join(dir, entry.name);
    const here = ['preview.html', 'index.html'].filter((f) => existsSync(join(sub, f)));
    return here.length ? [`${prefix}${entry.name}/${here[0] === 'index.html' ? '' : here[0]}`] : [];
  });
}

function listing(response, dir, pathname) {
  const base = pathname.endsWith('/') ? pathname : `${pathname}/`;
  const entries = readdirSync(dir, { withFileTypes: true })
    .filter((e) => !e.name.startsWith('.'))
    .sort(
      (a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name),
    );
  const escape = (text) =>
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
function stream(file, response) {
  response.on('close', () => file.destroy());
  file.on('error', () => response.destroy());
  file.pipe(response);
}

function send(response, status, message) {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end(message);
}
