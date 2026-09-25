/** Entrada de la tabla de contenidos, tal como la declara el EPUB (árbol). */
export interface TocNode {
  title: string;
  /** Destino resuelto dentro del ZIP. null si la entrada no enlaza a nada (encabezado de grupo). */
  target: { path: string; fragment: string | null } | null;
  children: TocNode[];
}

/**
 * Hito estructural del libro (dónde empieza el cuerpo, la portada, el índice...).
 * Viene de `<nav epub:type="landmarks">` (EPUB 3) o de `<guide>` (EPUB 2), con el
 * tipo normalizado al vocabulario de `epub:type`.
 */
export interface Landmark {
  type: string;
  path: string;
  fragment: string | null;
}

export type NavigationSource = 'nav' | 'ncx' | 'spine';

export interface Navigation {
  source: NavigationSource;
  /** Vacío cuando `source = 'spine'`. */
  toc: TocNode[];
  landmarks: Landmark[];
}
