import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildEpub } from '../../../packages/epub-pipeline/test/helpers/build-epub.js';
import { inspect } from '../src/commands/inspect.js';
import { preview } from '../src/commands/preview.js';

let dir: string;
let epub: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'lectio-cli-'));
  epub = join(dir, 'libro.epub');
  await writeFile(
    epub,
    await buildEpub({
      metadata: { title: 'Libro </script> peligroso' },
      chapters: [
        {
          id: 'c1',
          title: 'Uno',
          body: `<h1>Uno</h1><p>Texto &lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt; ${'y más texto. '.repeat(200)}</p>`,
        },
      ],
    }),
  );
});

afterAll(() => rm(dir, { recursive: true, force: true }));

describe('lectio preview', () => {
  it('genera una página autocontenida con los datos del libro', async () => {
    const out = join(dir, 'preview.html');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await preview(epub, { out });
    const html = await readFile(out, 'utf8');

    const json = /<script id="lectio-data" type="application\/json">([\s\S]*?)<\/script>/.exec(
      html,
    )?.[1];
    const data = JSON.parse(json ?? 'null');
    expect(data.book.title).toBe('Libro </script> peligroso');
    expect(data.chapters[0].title).toBe('Uno');
    expect(data.chapters[0].sentences.length).toBeGreaterThan(0);
  });

  it('el texto del libro no puede cerrar el <script> de datos', async () => {
    const out = join(dir, 'preview.html');
    await preview(epub, { out });
    const html = await readFile(out, 'utf8');
    const opening = '<script id="lectio-data" type="application/json">';
    const dataScript = html.slice(html.indexOf(opening) + opening.length);

    // Dentro del JSON, "<" va escapado: el primer "</script>" es el cierre real del bloque.
    const closing = dataScript.indexOf('</script>');
    expect(dataScript.slice(0, closing)).not.toContain('<');
    expect(html).toContain('<title>Libro &lt;/script&gt; peligroso · Lectio</title>');
  });
});

describe('lectio inspect', () => {
  it('--json devuelve un resumen sin HTML', async () => {
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((line: string) => lines.push(line));
    await inspect(epub, { json: true });
    const summary = JSON.parse(lines.join('\n'));

    expect(summary.metadata.title).toBe('Libro </script> peligroso');
    expect(summary.chapters[0]).toMatchObject({ title: 'Uno', kind: 'narrative' });
    expect(summary.chapters[0]).not.toHaveProperty('contentHtml');
  });
});
