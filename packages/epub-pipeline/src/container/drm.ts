import { attr, child, children, parseXml } from '../xml.js';
import type { EpubArchive } from './archive.js';

export type DrmScheme = 'adobe-adept' | 'readium-lcp' | 'apple-fairplay' | 'unknown-encryption';

export interface DrmDetection {
  scheme: DrmScheme;
  /** Archivo que delató la protección. */
  evidence: string;
}

/**
 * Algoritmos de ofuscación de fuentes. No son DRM: solo impiden extraer las
 * fuentes embebidas, y el texto del libro queda legible.
 */
const FONT_OBFUSCATION_ALGORITHMS = new Set([
  'http://www.idpf.org/2008/embedding',
  'http://ns.adobe.com/pdf/enc#RC',
]);

/** Archivos de licencia que identifican el sistema de DRM. */
const LICENSE_FILES: ReadonlyArray<[path: string, scheme: DrmScheme]> = [
  ['META-INF/license.lcpl', 'readium-lcp'],
  ['META-INF/sinf.xml', 'apple-fairplay'],
  ['META-INF/rights.xml', 'adobe-adept'],
];

const ENCRYPTION_PATH = 'META-INF/encryption.xml';

export function detectDrm(archive: EpubArchive): DrmDetection | null {
  for (const [path, scheme] of LICENSE_FILES) {
    if (archive.has(path)) return { scheme, evidence: path };
  }

  const xml = archive.readText(ENCRYPTION_PATH);
  if (xml === undefined) return null;

  // Un encryption.xml ilegible no permite asegurar que el contenido esté en claro.
  const unreadable: DrmDetection = { scheme: 'unknown-encryption', evidence: ENCRYPTION_PATH };
  let parsed;
  try {
    parsed = parseXml(xml);
  } catch {
    return unreadable;
  }
  // `<encryption/>` vacío es válido y se parsea como texto, no como objeto.
  if (!('encryption' in parsed)) return unreadable;
  const encrypted = children(child(parsed, 'encryption'), 'EncryptedData');

  const cipherAlgorithms = encrypted
    .map((data) => attr(child(data, 'EncryptionMethod'), 'Algorithm'))
    .filter((algorithm) => !algorithm || !FONT_OBFUSCATION_ALGORITHMS.has(algorithm));

  return cipherAlgorithms.length > 0
    ? { scheme: 'unknown-encryption', evidence: ENCRYPTION_PATH }
    : null;
}
