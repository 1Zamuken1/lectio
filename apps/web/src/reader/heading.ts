// Sin dependencias: también lo usa el prerender del build (build/prerender.ts).

/**
 * ¿El encabezado con que abre el capítulo es su título? Entonces el nuestro queda solo para
 * lectores de pantalla. Se compara por palabras completas: "i" no coincide dentro de
 * "a vindication".
 */
export function headingMatchesTitle(heading: string, title: string): boolean {
  const simplify = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  const a = simplify(heading);
  const b = simplify(title);
  const contains = (outer: string, inner: string) => ` ${outer} `.includes(` ${inner} `);
  return a !== '' && b !== '' && (contains(a, b) || contains(b, a));
}
