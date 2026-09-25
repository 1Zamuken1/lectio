/**
 * Resolución de `href` dentro del EPUB. Los href del OPF, el nav y el NCX son
 * URLs relativas al documento que las contiene; las rutas del ZIP son rutas
 * planas desde la raíz del contenedor.
 */

export interface ResolvedHref {
  /** Ruta dentro del ZIP (decodificada, normalizada). */
  path: string;
  /** Fragmento sin `#`, o null. */
  fragment: string | null;
}

/**
 * Resuelve `href` relativo al documento `basePath`.
 * Devuelve null si el href es externo (http:, mailto:, data:...) o si intenta
 * salir de la raíz del contenedor (`../../fuera`).
 */
export function resolveHref(basePath: string, href: string): ResolvedHref | null {
  const trimmed = href.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;

  const hashIndex = trimmed.indexOf('#');
  const rawPath = hashIndex === -1 ? trimmed : trimmed.slice(0, hashIndex);
  const rawFragment = hashIndex === -1 ? null : trimmed.slice(hashIndex + 1);
  const fragment = rawFragment ? safeDecode(rawFragment) : null;

  // href="#nota3": referencia dentro del mismo documento.
  if (rawPath === '') return { path: basePath, fragment };

  const decoded = safeDecode(rawPath.split('?')[0] ?? '');
  const joined = decoded.startsWith('/') ? decoded.slice(1) : joinPath(dirname(basePath), decoded);
  const path = normalizePath(joined);
  return path === null ? null : { path, fragment };
}

export function dirname(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? '' : path.slice(0, index);
}

function joinPath(dir: string, relative: string): string {
  return dir ? `${dir}/${relative}` : relative;
}

/** Resuelve `.` y `..`. Devuelve null si la ruta escapa de la raíz. */
function normalizePath(path: string): string | null {
  const segments: string[] = [];
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (segments.length === 0) return null;
      segments.pop();
    } else {
      segments.push(segment);
    }
  }
  return segments.join('/');
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
