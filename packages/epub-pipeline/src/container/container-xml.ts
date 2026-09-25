import { PipelineError } from '../errors.js';
import { attr, child, children, parseXml } from '../xml.js';
import type { EpubArchive } from './archive.js';

const CONTAINER_PATH = 'META-INF/container.xml';
const OPF_MEDIA_TYPE = 'application/oebps-package+xml';

/** Devuelve la ruta del documento de paquete (OPF) declarada en META-INF/container.xml. */
export function findPackagePath(archive: EpubArchive): string {
  const xml = archive.readText(CONTAINER_PATH);
  if (xml === undefined) {
    throw new PipelineError('MISSING_PACKAGE', `Falta ${CONTAINER_PATH}.`);
  }

  let rootfiles;
  try {
    rootfiles = children(child(parseXml(xml).container, 'rootfiles'), 'rootfile');
  } catch (cause) {
    throw new PipelineError('MISSING_PACKAGE', `${CONTAINER_PATH} no es XML válido.`, { cause });
  }

  // Un contenedor puede declarar varias renditions; se usa la primera que sea un OPF.
  const rootfile =
    rootfiles.find((r) => attr(r, 'media-type') === OPF_MEDIA_TYPE) ??
    rootfiles.find((r) => attr(r, 'media-type') === undefined);
  const fullPath = attr(rootfile, 'full-path');
  if (!fullPath) {
    throw new PipelineError('MISSING_PACKAGE', `${CONTAINER_PATH} no declara ningún OPF.`);
  }

  const candidates = [fullPath, safeDecode(fullPath)];
  const found = candidates.find((path) => archive.has(path));
  if (!found) {
    throw new PipelineError('MISSING_PACKAGE', `El OPF declarado (${fullPath}) no existe.`, {
      details: { path: fullPath },
    });
  }
  return found;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
