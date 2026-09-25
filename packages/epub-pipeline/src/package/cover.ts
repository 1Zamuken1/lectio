import type { EpubArchive } from '../container/archive.js';
import { resolveHref } from '../paths.js';
import type { ManifestItem, PackageDocument } from './opf.js';

export type CoverSource = 'cover-image-property' | 'meta-cover' | 'guide-cover' | 'manifest-name';

export interface CoverImage {
  path: string;
  mediaType: string;
  data: Buffer;
  /** Estrategia que encontró la portada (queda en el reporte). */
  source: CoverSource;
}

/**
 * Busca la portada con estrategias en orden de confiabilidad:
 * 1. EPUB 3: item con `properties="cover-image"`.
 * 2. EPUB 2: `<meta name="cover" content="id-del-item">`.
 * 3. Guide `type="cover"`: primera imagen del documento de portada.
 * 4. Respaldo: item de imagen cuyo id o nombre contiene "cover".
 */
export function findCover(archive: EpubArchive, pkg: PackageDocument): CoverImage | null {
  const items = [...pkg.manifest.values()];
  const metaContent = pkg.metadata.metas.find((m) => m.name === 'cover')?.content;
  const guideCover = pkg.guide.find((ref) => ref.type === 'cover');

  const strategies: Array<[CoverSource, () => ManifestItem | null | undefined]> = [
    ['cover-image-property', () => items.find((i) => i.properties.includes('cover-image'))],
    // Algunos EPUB ponen el href en lugar del id: se aceptan ambos.
    [
      'meta-cover',
      () =>
        metaContent
          ? (pkg.manifest.get(metaContent) ?? items.find((i) => i.href === metaContent))
          : null,
    ],
    ['guide-cover', () => guideCover && firstImageOf(archive, pkg, guideCover.path)],
    [
      'manifest-name',
      () => items.find((i) => isImage(i) && /cover|portada/i.test(`${i.id} ${i.href}`)),
    ],
  ];

  // Una estrategia que apunta a un archivo inexistente o que no es imagen no descarta las siguientes.
  for (const [source, candidate] of strategies) {
    const item = candidate();
    const data = item && isImage(item) ? archive.read(item.path) : undefined;
    if (item && data) return { path: item.path, mediaType: item.mediaType, data, source };
  }
  return null;
}

function firstImageOf(
  archive: EpubArchive,
  pkg: PackageDocument,
  documentPath: string,
): ManifestItem | null {
  const item = [...pkg.manifest.values()].find((i) => i.path === documentPath);
  // La guía puede apuntar directamente a una imagen.
  if (item && isImage(item)) return item;

  const html = archive.readText(documentPath);
  if (!html) return null;
  // <img src="..."> o <image xlink:href="..."> (portadas en SVG). Basta una regex:
  // solo se busca el primer atributo de imagen, no se interpreta el documento.
  const match = /<(?:img|image)\b[^>]*?\s(?:src|xlink:href|href)\s*=\s*["']([^"']+)["']/i.exec(
    html,
  );
  const resolved = match?.[1] ? resolveHref(documentPath, match[1]) : null;
  if (!resolved) return null;
  return [...pkg.manifest.values()].find((i) => i.path === resolved.path && isImage(i)) ?? null;
}

function isImage(item: ManifestItem): boolean {
  return item.mediaType.startsWith('image/');
}
