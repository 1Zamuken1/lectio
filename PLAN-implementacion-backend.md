# Plan de implementación: backend (API + worker)

> Documento temporal de trabajo, como `PLAN-implementacion-pipeline.md`. Se elimina al terminar esta etapa; las decisiones permanentes viven en `docs/`.

## Objetivo

Construir la app que diseñamos en `docs/lectio-arquitectura-api.md` y `docs/lectio-modelo-datos.md`: una API HTTP y un worker como **procesos separados**, sobre el mismo núcleo de dominio. Al final, una persona puede crear su cuenta, subir un EPUB, leerlo por capítulos, pedir el audio de un capítulo con la voz que elija (con cuota y límite de concurrencia) y retomar donde iba desde cualquier dispositivo. El lector actual pasa a consumir la API en la última fase.

Se construye **por fases que se cierran con commit**, y paramos a revisar al final de cada una.

### Fuera de esta etapa

La PWA en React (`docs/lectio-frontend.md`), el despliegue (Railway/Render), el adaptador de Kokoro y el circuit breaker entre proveedores (queda el puerto listo), los temas Bosque y Solarpunk, y el conversor de PDF.

---

## Decisiones técnicas

| Tema                   | Decisión                                                                                                                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework              | **NestJS 12**, arquitectura hexagonal por módulo (`domain` → `application` → `infrastructure`), tal como en la arquitectura §1.1. Hay que verificar en la fase 0 que corre como ESM con el resto del monorepo.                               |
| Base de datos          | **PostgreSQL 17** con **Prisma 7** (estable; Prisma 8 aún está en release candidate). Migraciones versionadas en el repo.                                                                                                                    |
| Colas                  | **BullMQ** + **Redis 7**: colas `book-processing` y `audio-generation` (arquitectura §1.5).                                                                                                                                                  |
| Infra local            | **Docker Compose** con Postgres y Redis (`docker compose up -d`). Docker Desktop ya está instalado.                                                                                                                                          |
| Configuración          | Variables de entorno validadas con `zod` al arrancar; `.env.example` versionado y `.env` ignorado.                                                                                                                                           |
| Auth                   | Contraseñas con **argon2id**. Access token JWT de 15 min, más un refresh token opaco de 30 días en cookie `httpOnly`, con rotación y detección de reutilización por familia (arquitectura §1.9).                                             |
| Storage                | Puerto `FileStorage` con un **adaptador local** para desarrollo (carpeta `storage/`, con soporte de `Range` y URLs firmadas con HMAC y vencimiento). El de R2/S3 va al desplegar.                                                            |
| TTS                    | Lo que hoy vive en `apps/cli/src/tts/` (adaptador de Edge, montaje MP3, perfiles de voz) pasa a un paquete nuevo, **`packages/tts`**: Node puro, sin NestJS. Lo usan la CLI y el worker.                                                     |
| Audio por voz          | `AudioSegment` único por **(capítulo, voz)**, en vez de 0..1 por capítulo: volver a una voz ya generada es instantáneo, como en el lector actual, y cada generación cuenta para la cuota. Se actualiza `lectio-modelo-datos.md`.             |
| Progreso de generación | El worker informa `done/total` en el progreso del job de BullMQ; `GET /chapters/:id/audio` lo devuelve. Es lo que usa el taller de copistas.                                                                                                 |
| Documentación          | **OpenAPI** generado por `@nestjs/swagger`, en `/api/docs`.                                                                                                                                                                                  |
| Tests                  | Unitarios (dominio y casos de uso, con repositorios en memoria) y **de integración** (Nest + supertest contra Postgres y Redis reales, en una base `lectio_test`). `pnpm test` corre los unitarios; `pnpm test:integration` necesita Docker. |
| Errores                | Filtro global con el formato de la arquitectura §2.7: `{ statusCode, code, message, error }`, con `code` estable.                                                                                                                            |

### Estructura objetivo

```
apps/
├── api/            NestJS HTTP: controladores, guards, Swagger (main.ts solo arranca HTTP)
├── worker/         NestJS application context: processors de BullMQ (sin HTTP)
└── cli/            la CLI de hoy, ahora sobre packages/tts
packages/
├── core/           módulos de dominio + aplicación + adaptadores (Prisma, storage, colas)
│   ├── prisma/     schema.prisma y migraciones
│   └── src/modules/{auth,books,chapters,audio,reading-progress,tts-usage,storage}
├── epub-pipeline/  (sin cambios)
├── tts/            Edge TTS, montaje MP3, perfiles de voz (sale de apps/cli)
└── shared/         DTOs y tipos que comparten api y el frontend
docker-compose.yml
.env.example
```

---

## Fases

Cada fase termina con `pnpm check` en verde (más `pnpm test:integration` desde la fase 1), un commit y una pausa para revisar.

### Fase 0: cimientos

- [ ] `docker-compose.yml` (Postgres 17 y Redis 7, con volúmenes y healthchecks) y `.env.example`.
- [ ] `packages/tts`: mover el adaptador de Edge, `mp3.ts`, `montage.ts` y `voices.ts` desde `apps/cli`, con sus tests; la CLI pasa a importarlos. Todo debe seguir funcionando igual (`narrate`, `serve`).
- [ ] `packages/core` con Prisma: el esquema completo del modelo de datos (con el cambio de audio por voz), la primera migración y el cliente generado.
- [ ] `apps/api` y `apps/worker` mínimos en NestJS 12: configuración validada, conexión a Postgres y Redis, `GET /api/v1/health` (con estado de la base y de Redis), Swagger en `/api/docs` y el filtro de errores.
- [ ] Verificar ESM, NestJS 12 y Prisma 7 juntos. Si algo no calza, decidirlo aquí y no en la mitad de una fase.
- [ ] `pnpm dev` levanta api + worker; `README` con los pasos (Docker, migraciones).
- [ ] Actualizar `docs/`: estructura del monorepo (`packages/tts`) y `AudioSegment` por voz.

### Fase 1: autenticación

- [ ] `POST /auth/register`, `/auth/login`, `/auth/refresh` y `/auth/logout` (arquitectura §2.1).
- [ ] Refresh token: se guarda solo su hash, con rotación, detección de reutilización (revoca la familia) y cookie `httpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`.
- [ ] Guard JWT global con `@Public()` para las rutas abiertas; `@CurrentUser()`.
- [ ] Rate limiting: global y más estricto en login y registro (arquitectura §1.8).
- [ ] CORS con orígenes desde la configuración y `credentials: true`.
- [ ] Tests de integración del flujo completo, incluida la reutilización de un token rotado.

### Fase 2: subir y procesar libros

- [ ] `POST /books` (multipart, límite de tamaño, `source_hash` y 409 si el usuario ya lo subió) → guarda el EPUB (FileStorage), crea `Book` en `pending` y encola `book-processing`.
- [ ] Worker `book-processing`: `processEpub` → guarda `Chapter[]` (HTML, oraciones con tramos de voz, notas, tipo) y actualiza `Book` (metadatos, portada, `nav_source`, `pipeline_version`, reporte). Si falla, guarda `error` con su `error_code`.
- [ ] `GET /books`, `GET /books/:id` (con el estado del audio por capítulo y voz), `GET /books/:id/report` y `DELETE /books/:id`.
- [ ] Portada servida desde el storage.
- [ ] Tests de integración con EPUB del corpus: subir, esperar a que el worker termine y verificar capítulos y reporte; DRM y archivo inválido.

### Fase 3: leer y retomar

- [ ] `GET /chapters/:id` con `ETag` y `304` (arquitectura §1.11); nunca expone el texto de narración.
- [ ] `PUT` y `GET /books/:id/progress` con `clientUpdatedAt` (gana el más reciente; 400 si viene del futuro o si el índice está fuera de rango).
- [ ] Control de acceso: solo el propietario (los libros públicos llegan en la fase 5).
- [ ] Tests de integración: ETag, conflicto entre dos dispositivos y acceso ajeno (403).

### Fase 4: audio

- [ ] `POST /chapters/:id/audio { voiceId }`: transacción con bloqueo por usuario (`SELECT … FOR UPDATE`), cuota (`remaining = quota − consumed − reserved`) y concurrencia (429 con `code`). Es idempotente si ya hay un trabajo pendiente para ese capítulo y esa voz.
- [ ] Worker `audio-generation`: unidades de voz → `packages/tts` (reintentos por unidad) → MP3 + `alignment.json` al storage → en una transacción, `AudioSegment` `ready` + `TtsUsageLog` + contador del usuario. Limitador global de BullMQ (RNF-07).
- [ ] `GET /chapters/:id/audio?voice=`: estado, progreso (`done/total`) y URL firmada; el audio se sirve con `Range` (206).
- [ ] `GET /users/me/usage` (arquitectura §2.6) y `GET /voices` (perfiles con su muestra).
- [ ] Tests: la cuota bajo dos solicitudes simultáneas (solo una pasa), la concurrencia, la idempotencia, un fallo que libera la reserva, y la generación real con Edge solo en un test marcado como lento.

### Fase 5: biblioteca pública

- [ ] Script interno `pnpm seed:public` que carga libros del corpus como públicos (`owner_id = null`, `slug`) y genera su audio como sistema (sin cuota, sin `TtsUsageLog`).
- [ ] `GET /books/public` y `GET /books/public/:slug`; acceso sin autenticación a libros, capítulos y audio públicos, y 403 al pedir audio de un libro público.
- [ ] Progreso de usuarios autenticados sobre libros públicos.

### Fase 6: el lector sobre la API

- [ ] El lector y la biblioteca actuales pasan a consumir la API: login y registro, subir EPUB desde la biblioteca, capítulos por demanda, audio y progreso del servidor. El taller de copistas usa el progreso real del job.
- [ ] `lectio serve` queda para uso sin conexión (la CLI sigue funcionando sola).
- [ ] Revisión de extremo a extremo: cuenta nueva → subir un EPUB → leer → escuchar con dos voces → retomar en otra pestaña.

---

## Riesgos conocidos

- **NestJS 12 con ESM y Prisma 7:** Prisma 7 cambió su generador (cliente sin motor de Rust y _driver adapters_), y NestJS nació en CommonJS. Se verifica en la fase 0, antes de construir encima.
- **Docker en Windows:** Docker Desktop tiene que estar abierto para desarrollar y para los tests de integración. Si molesta, el plan B es Postgres y Redis en la nube (Neon y Upstash) solo cambiando el `.env`.
- **Edge TTS en el worker:** es el mismo servicio no oficial de la CLI (`docs/lectio-decision-tts.md` §2). El limitador global y los reintentos por unidad son la defensa; el adaptador de Kokoro sigue fuera de esta etapa.
