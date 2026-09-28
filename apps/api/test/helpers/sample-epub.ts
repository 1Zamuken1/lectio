import { buildEpub } from '../../../../packages/epub-pipeline/test/helpers/build-epub.js';

/** PNG de 1×1: sirve de portada y de ilustración dentro de un capítulo. */
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

/** Dos capítulos: el primero con una ilustración y una nota; el segundo con diálogo. */
export function sampleEpub(title = 'El jardín de prueba'): Promise<Buffer> {
  return buildEpub({
    metadata: { title, creators: ['Ana Autora'], language: 'es' },
    extraManifestItems: [
      '<item id="portada" href="img/portada.png" media-type="image/png" properties="cover-image"/>',
      '<item id="figura" href="img/figura.png" media-type="image/png"/>',
    ].join(''),
    extraFiles: { 'OEBPS/img/portada.png': PNG, 'OEBPS/img/figura.png': PNG },
    chapters: [
      {
        id: 'cap1',
        title: 'Capítulo primero',
        body: `<h1>Capítulo primero</h1><p>${'El viajero miró el camino y siguió adelante. '.repeat(60)}</p><p>Una nota al pie.<a epub:type="noteref" href="#n1">1</a></p><aside epub:type="footnote" id="n1"><p>El texto de la nota.</p></aside><p><img src="img/figura.png" alt="Un mapa"/></p>`,
      },
      {
        id: 'cap2',
        title: 'Capítulo segundo',
        body: `<h1>Capítulo segundo</h1><p>—¿Qué llevas ahí? —preguntó el hombre.</p><p>${'Nada, señor. '.repeat(200)}</p>`,
      },
    ],
  });
}

/** Un capítulo con la palabra que hace fallar al proveedor silencioso (TTS_PROVIDER=silent). */
export function failingEpub(): Promise<Buffer> {
  return buildEpub({
    metadata: { title: 'El libro que no suena', creators: ['Ana Autora'], language: 'es' },
    chapters: [
      {
        id: 'cap1',
        title: 'Capítulo único',
        body: `<h1>Capítulo único</h1><p>${'Aquí todo iba bien. '.repeat(40)}</p><p>Hasta que LECTIOFALLATTS apareció.</p>`,
      },
    ],
  });
}
