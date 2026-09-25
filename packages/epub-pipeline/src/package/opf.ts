import type { EpubArchive } from '../container/archive.js';
import { PipelineError, type PipelineWarning } from '../errors.js';
import { resolveHref } from '../paths.js';
import { attr, child, children, parseXml, textOf, type XmlNode } from '../xml.js';

export interface ManifestItem {
  id: string;
  /** href tal como aparece en el OPF. */
  href: string;
  /** Ruta resuelta dentro del ZIP. */
  path: string;
  mediaType: string;
  properties: string[];
}

export interface SpineItem {
  idref: string;
  /** `linear="no"`: fuera del orden principal de lectura (suele ser material auxiliar). */
  linear: boolean;
  item: ManifestItem;
}

export interface GuideReference {
  type: string;
  title: string | null;
  path: string;
  fragment: string | null;
}

/** Elemento de metadata Dublin Core (`dc:title`, `dc:creator`...). */
export interface DcElement {
  value: string;
  id: string | null;
  /** Atributos EPUB 2 (`opf:role`, `opf:file-as`); en EPUB 3 van como `meta refines`. */
  role: string | null;
}

/** `<meta>` en sus dos formas: EPUB 2 (`name`/`content`) y EPUB 3 (`property`/`refines`). */
export interface MetaElement {
  name: string | null;
  content: string | null;
  property: string | null;
  refines: string | null;
  value: string;
}

export interface PackageDocument {
  path: string;
  /** Versión mayor del paquete (2 o 3). */
  version: number;
  metadata: {
    titles: DcElement[];
    creators: DcElement[];
    languages: string[];
    identifiers: string[];
    metas: MetaElement[];
  };
  manifest: ReadonlyMap<string, ManifestItem>;
  spine: SpineItem[];
  /** Documento de navegación EPUB 3 (`properties="nav"`). */
  navItem: ManifestItem | null;
  /** NCX de EPUB 2 (atributo `toc` del spine, o por media-type). */
  ncxItem: ManifestItem | null;
  guide: GuideReference[];
}

const NCX_MEDIA_TYPE = 'application/x-dtbncx+xml';

export function parsePackage(
  archive: EpubArchive,
  opfPath: string,
  warnings: PipelineWarning[],
): PackageDocument {
  const packageNode = readPackageNode(archive, opfPath);
  const metadataNode = child(packageNode, 'metadata');
  const manifest = parseManifest(child(packageNode, 'manifest'), opfPath, archive, warnings);
  const spineNode = child(packageNode, 'spine');

  const navItem = [...manifest.values()].find((item) => item.properties.includes('nav')) ?? null;
  const ncxId = attr(spineNode, 'toc');
  const ncxItem =
    (ncxId ? manifest.get(ncxId) : undefined) ??
    [...manifest.values()].find((item) => item.mediaType === NCX_MEDIA_TYPE) ??
    null;

  return {
    path: opfPath,
    version: Number.parseInt(attr(packageNode, 'version') ?? '', 10) || (navItem ? 3 : 2),
    metadata: {
      titles: children(metadataNode, 'title').map(toDcElement),
      creators: children(metadataNode, 'creator').map(toDcElement),
      languages: children(metadataNode, 'language').map(textOf).filter(Boolean),
      identifiers: children(metadataNode, 'identifier').map(textOf).filter(Boolean),
      metas: children(metadataNode, 'meta').map(toMetaElement),
    },
    manifest,
    spine: parseSpine(spineNode, manifest, archive, warnings),
    navItem,
    ncxItem,
    guide: parseGuide(child(packageNode, 'guide'), opfPath),
  };
}

function readPackageNode(archive: EpubArchive, opfPath: string): XmlNode {
  const xml = archive.readText(opfPath);
  let packageNode: XmlNode | undefined;
  try {
    packageNode = xml === undefined ? undefined : child(parseXml(xml), 'package');
  } catch (cause) {
    throw new PipelineError('MISSING_PACKAGE', `El OPF (${opfPath}) no es XML válido.`, { cause });
  }
  if (!packageNode) {
    throw new PipelineError('MISSING_PACKAGE', `El OPF (${opfPath}) no tiene elemento <package>.`);
  }
  return packageNode;
}

function parseManifest(
  manifestNode: XmlNode | undefined,
  opfPath: string,
  archive: EpubArchive,
  warnings: PipelineWarning[],
): Map<string, ManifestItem> {
  const manifest = new Map<string, ManifestItem>();
  for (const node of children(manifestNode, 'item')) {
    const id = attr(node, 'id');
    const href = attr(node, 'href');
    const resolved = href ? resolveHref(opfPath, href) : null;
    if (!id || !href || !resolved) continue;

    const item: ManifestItem = {
      id,
      href,
      path: resolved.path,
      mediaType: (attr(node, 'media-type') ?? '').toLowerCase(),
      properties: splitTokens(attr(node, 'properties')),
    };
    if (!archive.has(item.path)) {
      warnings.push({
        code: 'MANIFEST_ITEM_MISSING',
        message: `El manifest declara ${item.path}, pero el archivo no existe.`,
        details: { id, path: item.path },
      });
    }
    manifest.set(id, item);
  }
  return manifest;
}

function parseSpine(
  spineNode: XmlNode | undefined,
  manifest: ReadonlyMap<string, ManifestItem>,
  archive: EpubArchive,
  warnings: PipelineWarning[],
): SpineItem[] {
  const spine: SpineItem[] = [];
  for (const node of children(spineNode, 'itemref')) {
    const idref = attr(node, 'idref') ?? '';
    const item = manifest.get(idref);
    if (!item || !archive.has(item.path)) {
      warnings.push({
        code: 'SPINE_ITEM_UNRESOLVED',
        message: `El spine referencia "${idref}", que no existe en el manifest o en el archivo.`,
        details: { idref },
      });
      continue;
    }
    spine.push({ idref, linear: attr(node, 'linear') !== 'no', item });
  }
  return spine;
}

function parseGuide(guideNode: XmlNode | undefined, opfPath: string): GuideReference[] {
  return children(guideNode, 'reference').flatMap((node) => {
    const type = attr(node, 'type');
    const resolved = resolveHref(opfPath, attr(node, 'href') ?? '');
    if (!type || !resolved) return [];
    return [{ type: type.toLowerCase(), title: attr(node, 'title') ?? null, ...resolved }];
  });
}

function toDcElement(node: XmlNode): DcElement {
  return { value: textOf(node), id: attr(node, 'id') ?? null, role: attr(node, 'role') ?? null };
}

function toMetaElement(node: XmlNode): MetaElement {
  return {
    name: attr(node, 'name') ?? null,
    content: attr(node, 'content') ?? null,
    property: attr(node, 'property') ?? null,
    refines: attr(node, 'refines') ?? null,
    value: textOf(node),
  };
}

function splitTokens(value: string | undefined): string[] {
  return value ? value.split(/\s+/).filter(Boolean) : [];
}
