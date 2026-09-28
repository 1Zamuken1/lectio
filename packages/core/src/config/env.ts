import { existsSync } from 'node:fs';
import { z } from 'zod';

/**
 * Configuración de la API y el worker, validada al arrancar: si falta algo o está mal,
 * el proceso no arranca y dice qué corregir (en vez de fallar en la primera petición).
 */
const booleanFlag = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),
  API_PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  /** Vida del access token (JWT), en segundos. */
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  /** Vida del refresh token (cookie), en días. */
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  /** Cookie Secure: los navegadores la aceptan también en http://localhost. */
  COOKIE_SECURE: booleanFlag.default(true),
  /** Límite de solicitudes por IP (se apaga en los tests, salvo en los que lo prueban). */
  RATE_LIMIT_ENABLED: booleanFlag.default(true),
});

export type AppConfig = z.infer<typeof EnvSchema>;

/** `.env` de la raíz del monorepo: misma profundidad desde src/config y dist/config. */
const ROOT_ENV = new URL('../../../../.env', import.meta.url);

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (env === process.env && env.NODE_ENV !== 'production' && existsSync(ROOT_ENV)) {
    process.loadEnvFile(ROOT_ENV);
  }
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(entorno)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuración inválida (revisa .env o .env.example):\n${issues}`);
  }
  return parsed.data;
}
