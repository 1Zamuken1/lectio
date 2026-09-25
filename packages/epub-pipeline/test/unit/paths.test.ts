import { describe, expect, it } from 'vitest';
import { resolveHref } from '../../src/paths.js';

describe('resolveHref', () => {
  it('resuelve relativo al directorio del documento base', () => {
    expect(resolveHref('OEBPS/content.opf', 'Text/cap1.xhtml')).toEqual({
      path: 'OEBPS/Text/cap1.xhtml',
      fragment: null,
    });
  });

  it('separa el fragmento', () => {
    expect(resolveHref('OEBPS/nav.xhtml', 'cap1.xhtml#seccion-2')).toEqual({
      path: 'OEBPS/cap1.xhtml',
      fragment: 'seccion-2',
    });
  });

  it('un href solo con fragmento apunta al mismo documento', () => {
    expect(resolveHref('OEBPS/cap1.xhtml', '#nota3')).toEqual({
      path: 'OEBPS/cap1.xhtml',
      fragment: 'nota3',
    });
  });

  it('decodifica caracteres escapados', () => {
    expect(resolveHref('OEBPS/content.opf', 'Cap%C3%ADtulo%201.xhtml')?.path).toBe(
      'OEBPS/Capítulo 1.xhtml',
    );
  });

  it('resuelve segmentos .. dentro del contenedor', () => {
    expect(resolveHref('OEBPS/Text/cap1.xhtml', '../Images/fig.png')?.path).toBe(
      'OEBPS/Images/fig.png',
    );
  });

  it('funciona con el OPF en la raíz', () => {
    expect(resolveHref('content.opf', 'cap1.xhtml')?.path).toBe('cap1.xhtml');
  });

  it('rechaza rutas que escapan de la raíz del contenedor', () => {
    expect(resolveHref('OEBPS/content.opf', '../../etc/passwd')).toBeNull();
  });

  it('ignora URLs externas', () => {
    expect(resolveHref('OEBPS/cap1.xhtml', 'https://example.com/x')).toBeNull();
    expect(resolveHref('OEBPS/cap1.xhtml', 'mailto:alguien@example.com')).toBeNull();
    expect(resolveHref('OEBPS/cap1.xhtml', 'data:image/png;base64,AAAA')).toBeNull();
  });

  it('tolera escapes inválidos sin lanzar', () => {
    expect(resolveHref('OEBPS/content.opf', 'cap%zz.xhtml')?.path).toBe('OEBPS/cap%zz.xhtml');
  });
});
