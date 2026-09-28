/**
 * La cuota es por mes calendario en UTC (RF-23): el consumo se cuenta desde el día 1 y se
 * reinicia el día 1 del mes siguiente.
 */
export function quotaPeriod(now: Date): { periodStart: Date; resetsAt: Date } {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return {
    periodStart: new Date(Date.UTC(year, month, 1)),
    resetsAt: new Date(Date.UTC(year, month + 1, 1)),
  };
}

/** Lo que queda: la cuota menos lo cobrado y lo reservado (nunca negativo). */
export function remainingQuota(usage: {
  quota: number;
  consumed: number;
  reserved: number;
}): number {
  return Math.max(0, usage.quota - usage.consumed - usage.reserved);
}
