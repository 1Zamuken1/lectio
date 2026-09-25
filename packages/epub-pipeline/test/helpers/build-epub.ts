import { ZipFile } from 'yazl';

/**
 * Genera EPUB sintéticos en memoria para los tests. Cada test declara exactamente
 * el caso que prueba, en lugar de depender de archivos binarios versionados.
 *
 * Por defecto produce un EPUB 3 válido con nav.xhtml y toc.ncx. Las opciones
 * permiten romperlo de formas concretas (sin TOC, mimetype incorrecto, archivos
 * extra como encryption.xml, etc.).
 */

export interface BuildEpubChapter {
  /** id en el manifest. */
  id: string;
  /** Ruta relativa al OPF. Por defecto `<id>.xhtml`. */
  href?: string;
  /** Título usado en el <title> del documento y en el TOC por defecto. */
  title: string;
  /** Contenido interior del <body> (XHTML). */
  body: string;
  /** Atributos extra del <body>, ej. `epub:type="bodymatter"`. */
  bodyAttributes?: string;
  /** `linear="no"` en el spine. */
  linear?: boolean;
  /** Si es false, el capítulo no genera entrada en el TOC por defecto. */
  inToc?: boolean;
}

export interface BuildEpubTocEntry {
  title: string;
  /** Ruta relativa al OPF, con fragmento opcional (`cap1.xhtml#s2`). */
  href: string;
  children?: BuildEpubTocEntry[];
}

export interface BuildEpubOptions {
  version?: 2 | 3;
  metadata?: {
    title?: string;
    creators?: string[];
    language?: string;
    identifier?: string;
    /** Elementos extra dentro de <metadata>, en crudo. */
    extra?: string;
  };
  chapters: BuildEpubChapter[];
  /**
   * Qué navegación incluir. Por defecto: 'both' en EPUB 3, 'ncx' en EPUB 2.
   * 'none' produce un EPUB sin tabla de contenidos (fuerza el respaldo por spine).
   */
  navigation?: 'nav' | 'ncx' | 'both' | 'none';
  /** TOC explícito. Por defecto, una entrada plana por capítulo con `inToc !== false`. */
  toc?: BuildEpubTocEntry[];
  /** Contenido del archivo `mimetype`. `null` lo omite. */
  mimetype?: string | null;
  /** Omite META-INF/container.xml. */
  omitContainer?: boolean;
  /** Directorio del OPF dentro del ZIP. */
  opfDir?: string;
  /** Items extra del manifest, en crudo (ej. imágenes o una portada). */
  extraManifestItems?: string;
  /** Archivos adicionales, con ruta absoluta dentro del ZIP. */
  extraFiles?: Record<string, string | Buffer>;
}

const NAV_ID = 'nav';
const NCX_ID = 'ncx';

export async function buildEpub(options: BuildEpubOptions): Promise<Buffer> {
  const version = options.version ?? 3;
  const navigation = options.navigation ?? (version === 3 ? 'both' : 'ncx');
  const opfDir = options.opfDir ?? 'OEBPS';
  const metadata = {
    title: 'Libro de prueba',
    creators: ['Autora de Prueba'],
    language: 'es',
    identifier: 'urn:uuid:00000000-0000-0000-0000-000000000000',
    ...options.metadata,
  };
  const chapters = options.chapters.map((c) => ({ ...c, href: c.href ?? `${c.id}.xhtml` }));
  const toc =
    options.toc ??
    chapters.filter((c) => c.inToc !== false).map((c) => ({ title: c.title, href: c.href }));

  const includeNav = version === 3 && (navigation === 'nav' || navigation === 'both');
  const includeNcx = navigation === 'ncx' || navigation === 'both';

  const files = new Map<string, string | Buffer>();

  if (options.mimetype !== null) {
    files.set('mimetype', options.mimetype ?? 'application/epub+zip');
  }
  if (!options.omitContainer) {
    files.set('META-INF/container.xml', containerXml(`${opfDir}/content.opf`));
  }
  files.set(
    `${opfDir}/content.opf`,
    opfXml({
      version,
      metadata,
      chapters,
      includeNav,
      includeNcx,
      extraManifestItems: options.extraManifestItems ?? '',
    }),
  );
  if (includeNav) files.set(`${opfDir}/nav.xhtml`, navXhtml(toc));
  if (includeNcx) files.set(`${opfDir}/toc.ncx`, ncxXml(metadata.identifier, metadata.title, toc));
  for (const chapter of chapters) {
    files.set(`${opfDir}/${chapter.href}`, chapterXhtml(chapter, metadata.language));
  }
  for (const [path, content] of Object.entries(options.extraFiles ?? {})) {
    files.set(path, content);
  }

  return zip(files);
}

function zip(files: Map<string, string | Buffer>): Promise<Buffer> {
  const zipFile = new ZipFile();
  for (const [path, content] of files) {
    const buffer = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
    // El estándar OCF exige que `mimetype` vaya primero y sin comprimir.
    zipFile.addBuffer(buffer, path, { compress: path !== 'mimetype' });
  }
  zipFile.end();

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    zipFile.outputStream.on('data', (chunk: Buffer) => chunks.push(chunk));
    zipFile.outputStream.on('end', () => resolve(Buffer.concat(chunks)));
    zipFile.outputStream.on('error', reject);
  });
}

function containerXml(opfPath: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="${opfPath}" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
}

function opfXml(args: {
  version: 2 | 3;
  metadata: Required<Omit<NonNullable<BuildEpubOptions['metadata']>, 'extra'>> & {
    extra?: string;
  };
  chapters: (BuildEpubChapter & { href: string })[];
  includeNav: boolean;
  includeNcx: boolean;
  extraManifestItems: string;
}): string {
  const { version, metadata, chapters, includeNav, includeNcx } = args;
  const creators = metadata.creators.map((c) => `<dc:creator>${escapeXml(c)}</dc:creator>`);
  const modified =
    version === 3 ? '<meta property="dcterms:modified">2026-01-01T00:00:00Z</meta>' : '';

  const manifest = [
    includeNav
      ? `<item id="${NAV_ID}" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`
      : '',
    includeNcx ? `<item id="${NCX_ID}" href="toc.ncx" media-type="application/x-dtbncx+xml"/>` : '',
    ...chapters.map(
      (c) => `<item id="${c.id}" href="${c.href}" media-type="application/xhtml+xml"/>`,
    ),
    args.extraManifestItems,
  ].filter(Boolean);

  const spine = chapters.map(
    (c) => `<itemref idref="${c.id}"${c.linear === false ? ' linear="no"' : ''}/>`,
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="${version}.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${escapeXml(metadata.identifier)}</dc:identifier>
    <dc:title>${escapeXml(metadata.title)}</dc:title>
    ${creators.join('\n    ')}
    <dc:language>${escapeXml(metadata.language)}</dc:language>
    ${modified}
    ${metadata.extra ?? ''}
  </metadata>
  <manifest>
    ${manifest.join('\n    ')}
  </manifest>
  <spine${includeNcx ? ` toc="${NCX_ID}"` : ''}>
    ${spine.join('\n    ')}
  </spine>
</package>`;
}

function navXhtml(toc: BuildEpubTocEntry[]): string {
  const renderList = (entries: BuildEpubTocEntry[]): string =>
    `<ol>${entries
      .map(
        (e) =>
          `<li><a href="${e.href}">${escapeXml(e.title)}</a>${
            e.children?.length ? renderList(e.children) : ''
          }</li>`,
      )
      .join('')}</ol>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Índice</title></head>
<body>
  <nav epub:type="toc" id="toc">${renderList(toc)}</nav>
</body>
</html>`;
}

function ncxXml(identifier: string, title: string, toc: BuildEpubTocEntry[]): string {
  let playOrder = 0;
  const renderPoints = (entries: BuildEpubTocEntry[]): string =>
    entries
      .map((e) => {
        playOrder += 1;
        return `<navPoint id="np${playOrder}" playOrder="${playOrder}">
  <navLabel><text>${escapeXml(e.title)}</text></navLabel>
  <content src="${e.href}"/>
  ${e.children?.length ? renderPoints(e.children) : ''}
</navPoint>`;
      })
      .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="${escapeXml(identifier)}"/></head>
  <docTitle><text>${escapeXml(title)}</text></docTitle>
  <navMap>
${renderPoints(toc)}
  </navMap>
</ncx>`;
}

function chapterXhtml(chapter: BuildEpubChapter, language: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}">
<head><title>${escapeXml(chapter.title)}</title></head>
<body${chapter.bodyAttributes ? ` ${chapter.bodyAttributes}` : ''}>
${chapter.body}
</body>
</html>`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
