import { PIPELINE_VERSION, PipelineError } from '@lectio/epub-pipeline';
import { Command } from 'commander';
import { inspect } from './commands/inspect.js';
import { library } from './commands/library.js';
import { narrate, type NarrateOptions } from './commands/narrate.js';
import { preview } from './commands/preview.js';
import { voices } from './commands/voices.js';
import { style } from './ui/terminal.js';

export function createProgram(): Command {
  const program = new Command()
    .name('lectio')
    .description('Inspecciona y narra libros EPUB con el pipeline de Lectio.')
    .version(`pipeline v${PIPELINE_VERSION}`);

  program
    .command('inspect')
    .description('Muestra la estructura del libro: capítulos, clasificación y reporte de limpieza.')
    .argument('<archivo>', 'ruta del .epub')
    .option('--json', 'salida en JSON (sin HTML ni oraciones)')
    .action(withErrors((file: string, options: { json?: boolean }) => inspect(file, options)));

  program
    .command('preview')
    .description(
      'Genera un HTML para revisar el libro en el navegador: lectura, narración y reporte.',
    )
    .argument('<archivo>', 'ruta del .epub')
    .option('-o, --out <ruta>', 'archivo de salida (por defecto out/<libro>/preview.html)')
    .option(
      '--audio <carpeta>',
      'audio generado con "narrate" (por defecto, audio/ junto al preview)',
    )
    .option('--open', 'abrir el resultado en el navegador')
    .action(
      withErrors((file: string, options: { out?: string; audio?: string; open?: boolean }) =>
        preview(file, options),
      ),
    );

  program
    .command('narrate')
    .description(
      'Genera el audio de los capítulos con Edge TTS: un MP3 y su alineación por capítulo.',
    )
    .argument('<archivo>', 'ruta del .epub')
    .option(
      '-c, --chapters <lista>',
      'capítulos por su número en "inspect": 4, 4-6, 4-6,9 (por defecto, todos los narrativos)',
    )
    .option('-v, --voice <voz>', 'voz de Edge TTS (ver "lectio voices")')
    .option('-o, --out <carpeta>', 'carpeta de salida (por defecto out/<libro>/audio)')
    .option(
      '-r, --rate <velocidad>',
      'velocidad de síntesis, ej. "+0%", "+12%" (por defecto), "+25%"',
    )
    .option('--concurrency <n>', 'fragmentos en paralelo (1 a 4)', '2')
    .option('--force', 'regenerar aunque el capítulo ya exista')
    .action(withErrors((file: string, options: NarrateOptions) => narrate(file, options)));

  program
    .command('library')
    .description('Genera la biblioteca (index.html) con los libros que tienen preview.')
    .argument('[carpeta]', 'carpeta con un preview por libro', 'out')
    .action(withErrors((folder: string) => library(folder)));

  program
    .command('voices')
    .description('Lista las voces disponibles de Edge TTS.')
    .argument('[idioma]', 'filtro por idioma o región: es, es-CL, en-GB')
    .action(withErrors((filter?: string) => voices(filter)));

  return program;
}

/** Los errores esperables (EPUB con DRM, dañado...) se muestran como mensaje, sin stack. */
function withErrors<A extends unknown[]>(action: (...args: A) => Promise<void>) {
  return async (...args: A) => {
    try {
      await action(...args);
    } catch (error) {
      if (error instanceof PipelineError) {
        console.error(
          `${style.red('No se pudo procesar el libro:')} ${error.message} ${style.gray(`(${error.code})`)}`,
        );
      } else if (error instanceof Error && error.message.includes('está en uso')) {
        console.error(style.red(error.message));
      } else if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        console.error(style.red(`No existe el archivo: ${(error as NodeJS.ErrnoException).path}`));
      } else {
        throw error;
      }
      process.exitCode = 1;
    }
  };
}
