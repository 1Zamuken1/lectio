import { execFileSync } from 'node:child_process';
import { E2E_EMAIL_PATTERN } from './helpers.js';

/**
 * Al terminar, se borran las cuentas que crearon las pruebas (la API no tiene un endpoint
 * para eso): por SQL en el Postgres de desarrollo (`pnpm db:up`). Solo en local.
 */
export default function globalTeardown(): void {
  try {
    execFileSync(
      'docker',
      [
        'exec',
        'lectio-postgres-1',
        'psql',
        '-U',
        'lectio',
        '-d',
        'lectio',
        '-c',
        `delete from users where email like '${E2E_EMAIL_PATTERN}'`,
      ],
      { stdio: 'ignore' },
    );
  } catch {
    console.warn(
      `No se pudieron borrar las cuentas de prueba (${E2E_EMAIL_PATTERN}): bórralas a mano.`,
    );
  }
}
