/** Reglas de limpieza estructural (etapa 6); afectan tanto a la lectura como a la narración. */
export type StructuralRule =
  | 'S1_page_numbers'
  | 'S1_line_numbers'
  | 'S2_running_headers'
  | 'S2_duplicate_titles'
  | 'S3_hidden'
  | 'S4_notes';

/** Cuántos elementos tocó cada regla, separando la vía semántica de la heurística. */
export interface RuleStat {
  semantic: number;
  heuristic: number;
}

export type RuleStats = Record<StructuralRule, RuleStat>;

export function emptyStats(): RuleStats {
  const rules: StructuralRule[] = [
    'S1_page_numbers',
    'S1_line_numbers',
    'S2_running_headers',
    'S2_duplicate_titles',
    'S3_hidden',
    'S4_notes',
  ];
  return Object.fromEntries(rules.map((r) => [r, { semantic: 0, heuristic: 0 }])) as RuleStats;
}

export function addStats(target: RuleStats, source: RuleStats): void {
  for (const rule of Object.keys(source) as StructuralRule[]) {
    target[rule].semantic += source[rule].semantic;
    target[rule].heuristic += source[rule].heuristic;
  }
}
