/**
 * Por qué un audio listo ya no corresponde a lo vigente:
 * - `voice`: el perfil de voz cambió (prosody_key). Regenerarlo se cobra como siempre.
 * - `narration`: el libro se reprocesó y cambió lo que se narra en el capítulo
 *   (narration_hash). Es una corrección de Lectio, no consumo del usuario: se regenera
 *   gratis, a pedido.
 * Si cambiaron las dos cosas, manda `narration`: la regeneración es gratis igual.
 */
export type OutdatedReason = 'voice' | 'narration';

/**
 * ¿Cambió la narración desde que se generó? Una huella null es de antes de que existieran
 * (audio o capítulo sin reprocesar): no hay con qué comparar, así que se da por vigente.
 */
export function narrationChanged(segmentHash: string | null, chapterHash: string | null): boolean {
  return segmentHash !== null && chapterHash !== null && segmentHash !== chapterHash;
}

export function outdatedReason(
  segment: { prosodyKey: string | null; narrationHash: string | null },
  current: { prosodyKey: string; narrationHash: string | null },
): OutdatedReason | null {
  if (narrationChanged(segment.narrationHash, current.narrationHash)) return 'narration';
  if (segment.prosodyKey !== current.prosodyKey) return 'voice';
  return null;
}
