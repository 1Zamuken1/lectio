import { describe, expect, it } from 'vitest';
import { createProgram } from '../src/program.js';

describe('CLI', () => {
  it('se llama lectio y reporta la versión del pipeline', () => {
    const program = createProgram();

    expect(program.name()).toBe('lectio');
    expect(program.version()).toBe('pipeline v1');
  });
});
