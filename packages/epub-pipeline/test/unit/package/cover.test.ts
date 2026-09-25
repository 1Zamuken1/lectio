import { describe, expect, it } from 'vitest';
import { openEpub } from '../../../src/index.js';
import { buildEpub } from '../../helpers/build-epub.js';

const chapters = [{ id: 'cap1', title: 'Uno', body: '<p>Uno.</p>' }];
// Solo importa que sean bytes distinguibles; no se decodifica la imagen.
const coverBytes = Buffer.from('imagen-de-portada');
const otherBytes = Buffer.from('otra-imagen');

describe('findCover', () => {
  it('EPUB 3: properties="cover-image"', async () => {
    const { cover } = await openEpub(
      await buildEpub({
        chapters,
        extraManifestItems:
          '<item id="img" href="img/portada.jpg" media-type="image/jpeg" properties="cover-image"/>',
        extraFiles: { 'OEBPS/img/portada.jpg': coverBytes },
      }),
    );

    expect(cover).toMatchObject({
      path: 'OEBPS/img/portada.jpg',
      mediaType: 'image/jpeg',
      source: 'cover-image-property',
    });
    expect(cover?.data.equals(coverBytes)).toBe(true);
  });

  it('EPUB 2: <meta name="cover" content="id">', async () => {
    const { cover } = await openEpub(
      await buildEpub({
        version: 2,
        chapters,
        metadata: { extra: '<meta name="cover" content="img-portada"/>' },
        extraManifestItems: '<item id="img-portada" href="p.png" media-type="image/png"/>',
        extraFiles: { 'OEBPS/p.png': coverBytes },
      }),
    );

    expect(cover).toMatchObject({ path: 'OEBPS/p.png', source: 'meta-cover' });
  });

  it('EPUB 2: <meta name="cover"> con el href en vez del id', async () => {
    const { cover } = await openEpub(
      await buildEpub({
        version: 2,
        chapters,
        metadata: { extra: '<meta name="cover" content="p.png"/>' },
        extraManifestItems: '<item id="i1" href="p.png" media-type="image/png"/>',
        extraFiles: { 'OEBPS/p.png': coverBytes },
      }),
    );

    expect(cover).toMatchObject({ path: 'OEBPS/p.png', source: 'meta-cover' });
  });

  it('guide type="cover": primera imagen del documento de portada (incluye SVG)', async () => {
    const epub = await buildEpub({
      version: 2,
      chapters: [
        {
          id: 'portada',
          title: 'Portada',
          body: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                   <image xlink:href="../Images/tapa.jpg"/></svg>`,
          href: 'Text/portada.xhtml',
        },
        ...chapters,
      ],
      extraManifestItems: '<item id="tapa" href="Images/tapa.jpg" media-type="image/jpeg"/>',
      extraFiles: { 'OEBPS/Images/tapa.jpg': coverBytes },
    });
    const { cover } = await openEpub(
      await withGuide(epub, '<reference type="cover" title="Portada" href="Text/portada.xhtml"/>'),
    );

    expect(cover).toMatchObject({ path: 'OEBPS/Images/tapa.jpg', source: 'guide-cover' });
  });

  it('respaldo: imagen cuyo nombre contiene "cover"', async () => {
    const { cover } = await openEpub(
      await buildEpub({
        chapters,
        extraManifestItems: `<item id="fig1" href="fig1.jpg" media-type="image/jpeg"/>
                             <item id="img2" href="cover.jpg" media-type="image/jpeg"/>`,
        extraFiles: { 'OEBPS/fig1.jpg': otherBytes, 'OEBPS/cover.jpg': coverBytes },
      }),
    );

    expect(cover).toMatchObject({ path: 'OEBPS/cover.jpg', source: 'manifest-name' });
  });

  it('si una estrategia apunta a un archivo inexistente, prueba la siguiente', async () => {
    const { cover } = await openEpub(
      await buildEpub({
        chapters,
        extraManifestItems: `<item id="rota" href="rota.jpg" media-type="image/jpeg" properties="cover-image"/>
                             <item id="cover" href="cover.png" media-type="image/png"/>`,
        extraFiles: { 'OEBPS/cover.png': coverBytes },
      }),
    );

    expect(cover).toMatchObject({ path: 'OEBPS/cover.png', source: 'manifest-name' });
  });

  it('devuelve null si no hay portada', async () => {
    expect((await openEpub(await buildEpub({ chapters }))).cover).toBeNull();
  });
});

async function withGuide(epub: Buffer, references: string): Promise<Buffer> {
  const { readZip } = await import('../../helpers/read-zip.js');
  const { buildZip } = await import('../../helpers/build-epub.js');
  const entries = await readZip(epub);
  return buildZip(
    Object.fromEntries(
      entries.map((e) => [
        e.path,
        e.path.endsWith('.opf')
          ? e.content.replace('</package>', `<guide>${references}</guide></package>`)
          : e.data,
      ]),
    ),
  );
}
