/** Un capítulo guardado, con lo necesario para emparejarlo con el resultado nuevo. */
export interface StoredChapter {
  id: string;
  orderIndex: number;
  title: string;
}

/**
 * Cómo pasar de los capítulos guardados a los que produjo la versión nueva del pipeline
 * (docs/lectio-modelo-datos.md §4, reprocesamiento).
 *
 * - `keep[i]`: id del capítulo guardado que pasa a ser el capítulo nuevo `i` (se actualiza
 *   en su lugar, así su progreso y su audio siguen apuntándole), o null si es nuevo.
 * - `removed`: capítulos guardados que ya no existen.
 * - `unchanged`: misma estructura (mismo orden y títulos): todos se conservan.
 */
export interface ChapterPlan {
  keep: Array<string | null>;
  removed: string[];
  unchanged: boolean;
}

/**
 * Empareja por título respetando el orden: la subsecuencia común más larga de títulos
 * (LCS). Así dos "Capítulo" repetidos se emparejan en orden, un capítulo agregado o
 * quitado no arrastra a los demás, y uno que cambió de lugar se trata como quitado y
 * nuevo (los emparejamientos no se cruzan). Con la estructura intacta, cada capítulo
 * se empareja con el de su misma posición.
 */
export function planChapters(
  stored: readonly StoredChapter[],
  next: ReadonlyArray<{ orderIndex: number; title: string }>,
): ChapterPlan {
  const old = [...stored].sort((a, b) => a.orderIndex - b.orderIndex);
  const unchanged =
    old.length === next.length &&
    old.every((c, i) => c.orderIndex === next[i]!.orderIndex && c.title === next[i]!.title);
  if (unchanged) return { keep: old.map((c) => c.id), removed: [], unchanged };

  // lcs[i][j]: largo de la LCS entre old[i..] y next[j..].
  const lcs = Array.from({ length: old.length + 1 }, () =>
    new Array<number>(next.length + 1).fill(0),
  );
  for (let i = old.length - 1; i >= 0; i--) {
    for (let j = next.length - 1; j >= 0; j--) {
      lcs[i]![j] =
        old[i]!.title === next[j]!.title
          ? lcs[i + 1]![j + 1]! + 1
          : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const keep = new Array<string | null>(next.length).fill(null);
  const used = new Set<string>();
  for (let i = 0, j = 0; i < old.length && j < next.length;) {
    if (old[i]!.title === next[j]!.title) {
      keep[j] = old[i]!.id;
      used.add(old[i]!.id);
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) i++;
    else j++;
  }
  return { keep, removed: old.filter((c) => !used.has(c.id)).map((c) => c.id), unchanged };
}

/**
 * Dónde queda un progreso cuyo capítulo se quitó: en el capítulo que ahora ocupa esa
 * posición (o el último, si el libro quedó más corto), desde su primera oración.
 */
export function relocatedOrder(orderIndex: number, chapterCount: number): number {
  return Math.min(Math.max(orderIndex, 0), chapterCount - 1);
}
