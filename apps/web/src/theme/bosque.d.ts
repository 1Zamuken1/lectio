/** Las piezas SVG del Bosque élfico (bosque.js); las escenas, en bosque-scenes.js. */
export declare const Bosque: {
  /** El broche de hoja de Lórien en la punta de la enredadera (la barra de progreso). */
  brooch(): string;
  /** El pie del atril bajo la ficha del libro. */
  lecternStand(): string;
  /** El retoño de mallorn (el compañero). */
  sprout(): string;
  /** El taller del árbol que brota con un canto; `voice` elige el color de las túnicas. */
  workshop(voice: string): string;
  /** Los mensajeros con la litera que traen un libro subido (48 × 24, como la del Scriptorium). */
  bookCrew(): string;
  /** Las esquirlas del libro que se vuelve piedra (en lugar de las llamas). */
  stone(): string;
  /** El elfo que lleva un capítulo descargado a la raíz (12 × 15). */
  clothCarrier(voice?: string): string;
  /** La raíz que guarda las descargas (20 × 16). */
  rootStore(): string;
};
