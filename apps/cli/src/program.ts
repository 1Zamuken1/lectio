import { PIPELINE_VERSION, PipelineError } from '@lectio/epub-pipeline';
import { Command } from 'commander';
import { inspect } from './commands/inspect.js';
import { preview } from './commands/preview.js';
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
    .option('--open', 'abrir el resultado en el navegador')
    .action(
      withErrors((file: string, options: { out?: string; open?: boolean }) =>
        preview(file, options),
      ),
    );

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
      } else if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        console.error(style.red(`No existe el archivo: ${(error as NodeJS.ErrnoException).path}`));
      } else {
        throw error;
      }
      process.exitCode = 1;
    }
  };
}
