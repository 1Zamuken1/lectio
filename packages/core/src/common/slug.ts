/** Slug para URL a partir de un título: "Obras escogidas (Bécquer)" → "obras-escogidas-becquer". */
export function slugify(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60)
      .replace(/-$/, '') || 'libro'
  );
}
