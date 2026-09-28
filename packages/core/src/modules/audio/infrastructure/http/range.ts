/**
 * Cabecera Range de un solo tramo ("bytes=0-", "bytes=100-199", "bytes=-500"), que es lo que
 * piden los reproductores. Devuelve el tramo con los extremos incluidos, 'unsatisfiable' si
 * cae fuera del archivo (416) y null si no hay Range o no se entiende (200 completo, como
 * permite RFC 9110 §14.2).
 */
export function parseRange(
  header: string | undefined,
  size: number,
): { start: number; end: number } | 'unsatisfiable' | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, from, to] = match;
  if (from === '' && to === '') return null;
  if (from === '') {
    // Los últimos N bytes.
    const suffix = Number(to);
    if (suffix === 0) return 'unsatisfiable';
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(from);
  const end = to === '' ? size - 1 : Math.min(Number(to), size - 1);
  if (start >= size || end < start) return 'unsatisfiable';
  return { start, end };
}
