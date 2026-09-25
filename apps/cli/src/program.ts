import { PIPELINE_VERSION } from '@lectio/epub-pipeline';
import { Command } from 'commander';

export function createProgram(): Command {
  return new Command()
    .name('lectio')
    .description('Inspecciona y narra libros EPUB con el pipeline de Lectio.')
    .version(`pipeline v${PIPELINE_VERSION}`);
}
