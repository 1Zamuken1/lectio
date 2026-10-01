import { describe, expect, it } from 'vitest';
import { chapterCacheUrl, mediaCacheUrl, mediaKeyOf, resourceUrl } from '../src/pwa/cache-keys';
import { imagePaths } from '../src/pwa/downloads';

describe('claves de las descargas', () => {
  it('el audio se guarda por su clave, sin la firma ni el vencimiento', () => {
    const key = 'audio/abc/gonzalo-1a2b.mp3';
    const signed = new URL(
      `/api/v1/media?key=${encodeURIComponent(key)}&exp=1700000000&sig=xyz`,
      'https://lectio.test',
    );
    expect(mediaKeyOf(signed)).toBe(key);
    expect(mediaCacheUrl('https://lectio.test', key)).toBe(
      'https://lectio.test/api/v1/media?key=audio%2Fabc%2Fgonzalo-1a2b.mp3',
    );
    // La URL de la caché, leída como si la pidiera el <audio>, da la misma clave.
    expect(mediaKeyOf(new URL(mediaCacheUrl('https://lectio.test', key)))).toBe(key);
  });

  it('solo /media tiene clave de audio', () => {
    expect(mediaKeyOf(new URL('https://lectio.test/api/v1/chapters/1?key=x'))).toBeNull();
  });

  it('capítulos e imágenes, con las mismas URL que pide el lector', () => {
    expect(chapterCacheUrl('https://lectio.test', 'c1')).toBe(
      'https://lectio.test/api/v1/chapters/c1',
    );
    expect(resourceUrl('b1', 'OEBPS/img/mapa 1.png')).toBe(
      '/api/v1/books/b1/resources?path=OEBPS%2Fimg%2Fmapa%201.png',
    );
  });
});

describe('imagePaths', () => {
  it('saca las rutas de las imágenes del capítulo, sin repetir', () => {
    const html =
      '<p data-b="0">Texto</p><figure><img src="img/a.png" alt=""></figure>' +
      '<img src="img/b.jpg"><img src="img/a.png"><img alt="sin ruta">';
    expect(imagePaths(html)).toEqual(['img/a.png', 'img/b.jpg']);
  });
});
