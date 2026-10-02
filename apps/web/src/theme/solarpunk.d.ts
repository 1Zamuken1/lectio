/** Las piezas SVG del Solarpunk (solarpunk.js); las escenas, en solarpunk-scenes.js. */
export declare const Solarpunk: {
  /** Pol en miniatura, la perilla del riel de luz (la barra de progreso). */
  progressThumb(): string;
  /** El pie del atril bajo la ficha del libro. */
  lecternStand(): string;
  /** Pol, el dron jardinero (el compañero). */
  pol(): string;
  /** El taller del jardín vertical; `voice` da el color de las flores. */
  workshop(voice: string): string;
  /** Las dos Cúpulas que traen un libro subido (48 × 24, como la del Scriptorium). */
  bookCrew(): string;
  /** Las chispas del libro en cortocircuito (en lugar de las llamas). */
  shortCircuit(): string;
  /** El robotito que lleva un capítulo descargado a la cápsula (12 × 15). */
  cartCarrier(voice?: string): string;
  /** La cápsula de las descargas (20 × 16). */
  capsuleChest(): string;
  /** El libro de luz de la estantería holográfica, con el color en --px-book*. */
  lightBook(emblem: string): string;
  /** Una portada prediseñada (para el holograma), con el color en --px-book*. */
  cover(design: string): string;
  /** Los emblemas de los libros de luz y los nombres de las portadas. */
  EMBLEMS: string[];
  COVERS: string[];
};
