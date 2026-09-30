import { describe, expect, it } from 'vitest';
import { narrationChanged, outdatedReason } from '../../src/modules/audio/domain/freshness.js';
import { planChapters, relocatedOrder } from '../../src/modules/books/domain/reprocess.js';

const stored = (...titles: string[]) =>
  titles.map((title, orderIndex) => ({ id: `c${orderIndex}`, orderIndex, title }));
const next = (...titles: string[]) => titles.map((title, orderIndex) => ({ orderIndex, title }));

describe('planChapters', () => {
  it('misma estructura: cada capítulo conserva su id', () => {
    expect(planChapters(stored('Uno', 'Dos', 'Tres'), next('Uno', 'Dos', 'Tres'))).toEqual({
      keep: ['c0', 'c1', 'c2'],
      removed: [],
      unchanged: true,
    });
  });

  it('el orden guardado no importa, solo el orderIndex', () => {
    const [a, b] = stored('Uno', 'Dos');
    expect(planChapters([b!, a!], next('Uno', 'Dos')).keep).toEqual(['c0', 'c1']);
  });

  it('un capítulo nuevo en medio no arrastra a los que siguen', () => {
    expect(
      planChapters(stored('Uno', 'Dos', 'Tres'), next('Uno', 'Prólogo', 'Dos', 'Tres')),
    ).toEqual({
      keep: ['c0', null, 'c1', 'c2'],
      removed: [],
      unchanged: false,
    });
  });

  it('uno quitado o renombrado se pierde; los demás se conservan', () => {
    expect(planChapters(stored('Uno', 'Dos', 'Tres'), next('Uno', 'Tres'))).toEqual({
      keep: ['c0', 'c2'],
      removed: ['c1'],
      unchanged: false,
    });
    expect(planChapters(stored('Uno', 'Dos', 'Tres'), next('Uno', 'II', 'Tres'))).toEqual({
      keep: ['c0', null, 'c2'],
      removed: ['c1'],
      unchanged: false,
    });
  });

  it('títulos repetidos se emparejan en orden', () => {
    const plan = planChapters(
      stored('Capítulo', 'Capítulo', 'Capítulo'),
      next('Nota', 'Capítulo', 'Capítulo', 'Capítulo'),
    );
    expect(plan.keep).toEqual([null, 'c0', 'c1', 'c2']);
    expect(plan.removed).toEqual([]);
  });

  it('un capítulo que cambió de lugar no cruza los emparejamientos', () => {
    const plan = planChapters(stored('Uno', 'Dos', 'Tres'), next('Tres', 'Uno', 'Dos'));
    expect(plan.keep).toEqual([null, 'c0', 'c1']);
    expect(plan.removed).toEqual(['c2']);
  });
});

describe('relocatedOrder', () => {
  it('la misma posición, o la última si el libro quedó más corto', () => {
    expect(relocatedOrder(2, 5)).toBe(2);
    expect(relocatedOrder(7, 5)).toBe(4);
    expect(relocatedOrder(0, 1)).toBe(0);
  });
});

describe('vigencia del audio', () => {
  it('sin huella de un lado no hay con qué comparar: se da por vigente', () => {
    expect(narrationChanged(null, 'b')).toBe(false);
    expect(narrationChanged('a', null)).toBe(false);
    expect(narrationChanged('a', 'a')).toBe(false);
    expect(narrationChanged('a', 'b')).toBe(true);
  });

  it('manda la narración (gratis); si no, el perfil de voz (se cobra)', () => {
    const current = { prosodyKey: 'p2', narrationHash: 'n2' };
    expect(outdatedReason({ prosodyKey: 'p2', narrationHash: 'n2' }, current)).toBeNull();
    expect(outdatedReason({ prosodyKey: 'p1', narrationHash: 'n2' }, current)).toBe('voice');
    expect(outdatedReason({ prosodyKey: 'p2', narrationHash: 'n1' }, current)).toBe('narration');
    expect(outdatedReason({ prosodyKey: 'p1', narrationHash: 'n1' }, current)).toBe('narration');
  });
});
