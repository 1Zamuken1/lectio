import { describe, expect, it } from 'vitest';
import { openEpub } from '../../../src/index.js';
import { buildEpub } from '../../helpers/build-epub.js';

const chapters = [{ id: 'cap1', title: 'Uno', body: '<p>Texto.</p>' }];

function encryptionXml(entries: Array<{ algorithm: string; uri: string }>): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container"
            xmlns:enc="http://www.w3.org/2001/04/xmlenc#">
  ${entries
    .map(
      (e) => `<enc:EncryptedData>
    <enc:EncryptionMethod Algorithm="${e.algorithm}"/>
    <enc:CipherData><enc:CipherReference URI="${e.uri}"/></enc:CipherData>
  </enc:EncryptedData>`,
    )
    .join('\n  ')}
</encryption>`;
}

describe('detección de DRM', () => {
  it('un EPUB sin cifrado se abre', async () => {
    await expect(openEpub(await buildEpub({ chapters }))).resolves.toBeDefined();
  });

  it('la ofuscación de fuentes (IDPF y Adobe) no cuenta como DRM', async () => {
    const epub = await buildEpub({
      chapters,
      extraFiles: {
        'META-INF/encryption.xml': encryptionXml([
          { algorithm: 'http://www.idpf.org/2008/embedding', uri: 'OEBPS/fonts/a.otf' },
          { algorithm: 'http://ns.adobe.com/pdf/enc#RC', uri: 'OEBPS/fonts/b.otf' },
        ]),
      },
    });

    await expect(openEpub(epub)).resolves.toBeDefined();
  });

  it('contenido cifrado con AES se detecta aunque no haya archivo de licencia', async () => {
    const epub = await buildEpub({
      chapters,
      extraFiles: {
        'META-INF/encryption.xml': encryptionXml([
          { algorithm: 'http://www.idpf.org/2008/embedding', uri: 'OEBPS/fonts/a.otf' },
          { algorithm: 'http://www.w3.org/2001/04/xmlenc#aes128-cbc', uri: 'OEBPS/cap1.xhtml' },
        ]),
      },
    });

    await expect(openEpub(epub)).rejects.toMatchObject({
      code: 'DRM_PROTECTED',
      details: { scheme: 'unknown-encryption' },
    });
  });

  it.each([
    ['META-INF/rights.xml', 'adobe-adept'],
    ['META-INF/license.lcpl', 'readium-lcp'],
    ['META-INF/sinf.xml', 'apple-fairplay'],
  ])('identifica el sistema por su archivo de licencia (%s)', async (path, scheme) => {
    const epub = await buildEpub({ chapters, extraFiles: { [path]: '<licencia/>' } });

    await expect(openEpub(epub)).rejects.toMatchObject({
      code: 'DRM_PROTECTED',
      details: { scheme, evidence: path },
    });
  });

  it('un encryption.xml vacío no bloquea el libro', async () => {
    const epub = await buildEpub({
      chapters,
      extraFiles: {
        'META-INF/encryption.xml':
          '<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container"/>',
      },
    });

    await expect(openEpub(epub)).resolves.toBeDefined();
  });

  it('un encryption.xml ilegible se trata como cifrado (conservador)', async () => {
    const epub = await buildEpub({
      chapters,
      extraFiles: { 'META-INF/encryption.xml': '<<< no es xml' },
    });

    await expect(openEpub(epub)).rejects.toMatchObject({ code: 'DRM_PROTECTED' });
  });
});
