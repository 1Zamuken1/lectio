import { resolve } from 'node:path';

/** Colores ANSI mínimos; se desactivan si la salida no es una terminal o si NO_COLOR está definido. */
const enabled = process.stdout.isTTY && !process.env.NO_COLOR;
const ESC = String.fromCharCode(27);
const paint = (code: number) => (text: string) =>
  enabled ? ESC + '[' + code + 'm' + text + ESC + '[0m' : text;

export const style = {
  bold: paint(1),
  dim: paint(2),
  italic: paint(3),
  blue: paint(34),
  green: paint(32),
  yellow: paint(33),
  red: paint(31),
  gray: paint(90),
};

/**
 * Rutas relativas al directorio desde el que el usuario ejecutó el comando. Con
 * `pnpm lectio ...` el proceso corre dentro de apps/cli, pero pnpm conserva el
 * directorio original en INIT_CWD.
 */
export function userPath(path: string): string {
  return resolve(process.env.INIT_CWD ?? process.cwd(), path);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString('es', { useGrouping: 'always' });
}
