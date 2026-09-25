import { describe, expect, it } from 'vitest';
import { DEFAULT_ARCHIVE_LIMITS, openArchive } from '../../../src/container/archive.js';
import { buildEpub, buildZip } from '../../helpers/build-epub.js';

const limits = DEFAULT_ARCHIVE_LIMITS;

describe('openArchive', () => {
  it('lee las entradas y conserva su orden', async () => {
    const archive = await openArchive(
      await buildEpub({ chapters: [{ id: 'cap1', title: 'Uno', body: '<p>Hola.</p>' }] }),
      limits,
    );

    expect(archive.entryOrder[0]).toBe('mimetype');
    expect(archive.readText('mimetype')).toBe('application/epub+zip');
    expect(archive.has('OEBPS/cap1.xhtml')).toBe(true);
  });

  it('quita el BOM de UTF-8 y decodifica UTF-16', async () => {
    const archive = await openArchive(
      await buildZip({
        'utf8.txt': Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('ñandú')]),
        'utf16.txt': Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('ñandú', 'utf16le')]),
      }),
      limits,
    );

    expect(archive.readText('utf8.txt')).toBe('ñandú');
    expect(archive.readText('utf16.txt')).toBe('ñandú');
  });

  it('rechaza algo que no es un ZIP', async () => {
    await expect(openArchive(Buffer.from('esto no es un zip'), limits)).rejects.toMatchObject({
      code: 'INVALID_ARCHIVE',
    });
  });

  it('rechaza un ZIP truncado', async () => {
    const epub = await buildEpub({ chapters: [{ id: 'c', title: 'C', body: '<p>x</p>' }] });

    await expect(openArchive(epub.subarray(0, epub.length - 40), limits)).rejects.toMatchObject({
      code: 'INVALID_ARCHIVE',
    });
  });

  it('rechaza un archivo más pesado que el máximo permitido', async () => {
    const zip = await buildZip({ 'a.txt': 'hola' });

    await expect(
      openArchive(zip, { ...limits, maxArchiveBytes: zip.length - 1 }),
    ).rejects.toMatchObject({ code: 'LIMITS_EXCEEDED', details: { limit: 'maxArchiveBytes' } });
  });

  it('rechaza una zip bomb por tamaño descomprimido, sin descomprimirla', async () => {
    // 5 MB de ceros se comprimen a unos pocos KB.
    const bomb = await buildZip({ 'ceros.bin': Buffer.alloc(5 * 1024 * 1024) });
    expect(bomb.length).toBeLessThan(64 * 1024);

    await expect(
      openArchive(bomb, { ...limits, maxUncompressedBytes: 1024 * 1024 }),
    ).rejects.toMatchObject({
      code: 'LIMITS_EXCEEDED',
      details: { limit: 'maxUncompressedBytes' },
    });
  });

  it('rechaza un ZIP con demasiadas entradas', async () => {
    const files = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`f${i}.txt`, 'x']));

    await expect(
      openArchive(await buildZip(files), { ...limits, maxEntries: 5 }),
    ).rejects.toMatchObject({ code: 'LIMITS_EXCEEDED', details: { limit: 'maxEntries' } });
  });

  it('rechaza entradas con path traversal', async () => {
    // yazl no permite crear rutas con "..", así que se reemplazan los bytes del nombre
    // (misma longitud) en las cabeceras local y central del ZIP.
    const zip = await buildZip({ 'zz/evil.txt': 'pwned' });
    const evil = Buffer.from(
      zip.toString('latin1').replaceAll('zz/evil.txt', '../evil.txt'),
      'latin1',
    );

    await expect(openArchive(evil, limits)).rejects.toMatchObject({ code: 'INVALID_ARCHIVE' });
  });
});
