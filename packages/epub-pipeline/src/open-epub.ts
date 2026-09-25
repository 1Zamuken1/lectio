import {
  DEFAULT_ARCHIVE_LIMITS,
  openArchive,
  type ArchiveLimits,
  type EpubArchive,
} from './container/archive.js';
import { findPackagePath } from './container/container-xml.js';
import { detectDrm } from './container/drm.js';
import { PipelineError, type PipelineWarning } from './errors.js';
import { findCover, type CoverImage } from './package/cover.js';
import { extractMetadata, type BookMetadata } from './package/metadata.js';
import { parsePackage, type PackageDocument } from './package/opf.js';

export interface OpenEpubOptions {
  limits?: Partial<ArchiveLimits>;
}

/** Resultado de las etapas 1 (contenedor) y 2 (paquete). */
export interface OpenedEpub {
  archive: EpubArchive;
  package: PackageDocument;
  metadata: BookMetadata;
  cover: CoverImage | null;
  warnings: PipelineWarning[];
}

const EPUB_MIMETYPE = 'application/epub+zip';

export async function openEpub(file: Buffer, options: OpenEpubOptions = {}): Promise<OpenedEpub> {
  const warnings: PipelineWarning[] = [];

  // Etapa 1: contenedor.
  const archive = await openArchive(file, { ...DEFAULT_ARCHIVE_LIMITS, ...options.limits });
  checkMimetype(archive, warnings);

  const drm = detectDrm(archive);
  if (drm) {
    throw new PipelineError(
      'DRM_PROTECTED',
      'El libro está protegido con DRM y no puede procesarse.',
      { details: { scheme: drm.scheme, evidence: drm.evidence } },
    );
  }

  // Etapa 2: paquete.
  const pkg = parsePackage(archive, findPackagePath(archive), warnings);
  if (pkg.spine.length === 0) {
    throw new PipelineError(
      'NO_TEXT_CONTENT',
      'El libro no tiene documentos en su orden de lectura.',
    );
  }

  return {
    archive,
    package: pkg,
    metadata: extractMetadata(pkg, warnings),
    cover: findCover(archive, pkg),
    warnings,
  };
}

/**
 * OCF exige un archivo `mimetype` primero en el ZIP. Muchos EPUB reales lo traen
 * mal y los lectores los abren igual, así que solo se advierte.
 */
function checkMimetype(archive: EpubArchive, warnings: PipelineWarning[]): void {
  const mimetype = archive.readText('mimetype')?.trim();
  if (mimetype !== EPUB_MIMETYPE) {
    warnings.push({
      code: 'MIMETYPE_INVALID',
      message:
        mimetype === undefined
          ? 'Falta el archivo mimetype.'
          : `El archivo mimetype contiene "${mimetype}" en lugar de "${EPUB_MIMETYPE}".`,
    });
  } else if (archive.entryOrder[0] !== 'mimetype') {
    warnings.push({
      code: 'MIMETYPE_NOT_FIRST',
      message: 'El archivo mimetype no es la primera entrada del ZIP.',
    });
  }
}
