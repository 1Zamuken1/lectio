// Servidor estático mínimo para revisar out/ en el navegador: pnpm serve [carpeta] [puerto]
//
// Soporta peticiones Range (206 Partial Content): sin ellas el navegador no puede
// adelantar ni retroceder dentro de un MP3 (docs/lectio-frontend.md §6.3). El servidor
// de Python (http.server) no las soporta. Solo escucha en 127.0.0.1.

import { createReadStream, existsSync, statSync } from 'node:fs';
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
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
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
}).listen(port, '127.0.0.1', () => {
  console.log(`Sirviendo ${root} en http://localhost:${port}`);
});

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
