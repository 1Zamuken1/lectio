/** Nombre de carpeta a partir del título: "Don Quijote" → "don-quijote". */
export function slugify(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'libro'
  );
}
