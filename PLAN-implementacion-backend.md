# Plan de implementación: backend (API + worker)

> Documento temporal de trabajo. Se elimina al terminar esta etapa; las decisiones permanentes viven en `docs/`.

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

### Fase 0: cimientos (hecha)

- [x] `docker-compose.yml` (Postgres 17 y Redis 7, con volúmenes y healthchecks) y `.env.example`.
- [x] `packages/tts`: mover el adaptador de Edge, `mp3.ts`, `montage.ts` y `voices.ts` desde `apps/cli`, con sus tests; la CLI pasa a importarlos. Todo debe seguir funcionando igual (`narrate`, `serve`).
- [x] `packages/core` con Prisma: el esquema completo del modelo de datos (con el cambio de audio por voz), la primera migración y el cliente generado.
- [x] `apps/api` y `apps/worker` mínimos en NestJS 12: configuración validada, conexión a Postgres y Redis, `GET /api/v1/health` (con estado de la base y de Redis), Swagger en `/api/docs` y el filtro de errores.
- [x] Verificar ESM, NestJS 12 y Prisma 7 juntos. Si algo no calza, decidirlo aquí y no en la mitad de una fase.
- [x] `pnpm dev` levanta api + worker; `README` con los pasos (Docker, migraciones).
- [x] Actualizar `docs/`: estructura del monorepo (`packages/tts`) y `AudioSegment` por voz.

### Fase 1: autenticación (hecha)

- [x] `POST /auth/register`, `/auth/login`, `/auth/refresh` y `/auth/logout` (arquitectura §2.1).
- [x] Refresh token: se guarda solo su hash, con rotación, detección de reutilización (revoca la familia) y cookie `httpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`.
- [x] Guard JWT global con `@Public()` para las rutas abiertas; `@CurrentUser()`.
- [x] Rate limiting: global y más estricto en login y registro (arquitectura §1.8).
- [x] CORS con orígenes desde la configuración y `credentials: true`.
- [x] Tests de integración del flujo completo, incluida la reutilización de un token rotado.

### Fase 2: subir y procesar libros (hecha)

- [x] `POST /books` (multipart, límite de tamaño, `source_hash` y 409 si el usuario ya lo subió) → guarda el EPUB (FileStorage), crea `Book` en `pending` y encola `book-processing`.
- [x] Worker `book-processing`: `processEpub` → guarda `Chapter[]` (HTML, oraciones con tramos de voz, notas, tipo) y actualiza `Book` (metadatos, portada, `nav_source`, `pipeline_version`, reporte). Si falla, guarda `error` con su `error_code`.
- [x] `GET /books`, `GET /books/:id` (con el estado del audio por capítulo y voz), `GET /books/:id/report` y `DELETE /books/:id`.
- [x] Portada servida desde el storage.
- [x] Tests de integración con EPUB del corpus: subir, esperar a que el worker termine y verificar capítulos y reporte; DRM y archivo inválido.

### Fase 3: leer y retomar (hecha)

- [x] `GET /chapters/:id` con `ETag` y `304` (arquitectura §1.11); nunca expone el texto de narración.
- [x] `PUT` y `GET /books/:id/progress` con `clientUpdatedAt` (gana el más reciente; 400 si viene del futuro o si el índice está fuera de rango).
- [x] Control de acceso: solo el propietario (los libros públicos llegan en la fase 5).
- [x] Tests de integración: ETag, conflicto entre dos dispositivos y acceso ajeno (403).
- [x] Imágenes de los capítulos (`GET /books/:id/resources?path=`) y el progreso en la biblioteca (`GET /books`).

### Fase 4: audio (hecha)

- [x] `POST /chapters/:id/audio { voiceId }`: transacción con bloqueo por usuario (`SELECT … FOR UPDATE`), cuota (`remaining = quota − consumed − reserved`) y concurrencia (429 con `code`). Es idempotente si ya hay un trabajo pendiente para ese capítulo y esa voz.
- [x] Worker `audio-generation`: unidades de voz → `packages/tts` (reintentos por unidad) → MP3 + `alignment.json` al storage → en una transacción, `AudioSegment` `ready` + `TtsUsageLog` + contador del usuario. Limitador global de BullMQ (RNF-07).
- [x] `GET /chapters/:id/audio?voice=`: estado, progreso (`done/total`) y URL firmada; el audio se sirve con `Range` (206).
- [x] `GET /users/me/usage` (arquitectura §2.6) y `GET /voices` (perfiles con su muestra).
- [x] Tests: la cuota bajo dos solicitudes simultáneas (solo una pasa), la concurrencia, la idempotencia, un fallo que libera la reserva, y la generación real con Edge solo en un test marcado como lento.
- [x] Proveedor silencioso (`TTS_PROVIDER=silent`) para los tests y para desarrollar sin red; `GET /books/:id` con el estado del audio por capítulo y voz.

### Fase 5: biblioteca pública (hecha)

- [x] Script interno `pnpm seed:public` que carga libros del corpus como públicos (`owner_id = null`, `slug`) y genera su audio como sistema (sin cuota, sin `TtsUsageLog`).
- [x] `GET /books/public` y `GET /books/public/:slug`; acceso sin autenticación a libros, capítulos y audio públicos, y 403 al pedir audio de un libro público.
- [x] Progreso de usuarios autenticados sobre libros públicos.
- [x] Sesión opcional (`@OptionalAuth`): anónimo sin `Authorization`, 401 con un token inválido; un anónimo que pide un libro privado recibe 401. La biblioteca personal incluye los libros públicos empezados.

### Fase 6: el lector sobre la API

- [x] El lector y la biblioteca actuales pasan a consumir la API: login y registro, subir EPUB desde la biblioteca, capítulos por demanda, audio y progreso del servidor. El taller de copistas usa el progreso real del job. Diseño decidido en `docs/lectio-frontend.md` §2.3. Por etapas:
  - [x] 1. Base: `apps/web` (React, React Router, TanStack Query), tipos generados del OpenAPI, sesión coordinada entre pestañas (Web Locks + BroadcastChannel, con tests), temas portados, pantalla de título, biblioteca pública, celda y pergamino de entrada.
  - [x] 2. Las salas: biblioteca del monasterio y tu estudio con su arte, puerta con fundido, ficha en el atril, subir y soltar, estantes que se pasan con búsqueda y orden, la cuadrilla que trae el libro y el libro que arde y renace.
  - [x] 3. Lector y reproductor sobre la API: capítulos, imágenes, audio con voces, costo, taller con progreso real y progreso de lectura; mini reproductor en las salas, volumen y reporte.
- [x] `lectio serve` queda para uso sin conexión (la CLI sigue funcionando sola).
- [x] Revisión de extremo a extremo: cuenta nueva → subir un EPUB → leer → escuchar con dos voces → retomar en otra pestaña.

### Fase 7: PWA instalable y sin conexión

Diseño decidido en `docs/lectio-frontend.md` §2.4 (y §6.3, §6.4, §2.1). Por etapas:

- [x] 1. Base PWA: `vite-plugin-pwa` (manifest, app shell y fuentes precargados), ícono pixel, aviso "Nueva versión", botón "Instalar" y globo de iPhone, estado sin conexión (las salas con la última visita, lo no descargado apagado, subir y generar desactivados).
- [ ] 2. Descargas: capítulo, imágenes, audio y alineación en Cache Storage por `audioSegmentId`, índice en IndexedDB, audio con `Range` (206) desde el Service Worker, `storage.persist()`, botones en el atril y panel "Descargas".
- [ ] 3. Progreso sin conexión: cola en IndexedDB, al volver la red se envía solo el último por libro.
- [ ] 4. Prerender de `/`, `/biblioteca` y `/libros/:slug` (ficha + primer capítulo) desde `GET /books/public` al hacer el build.
- [ ] 5. Revisión: Playwright en modo `offline` (descargar, cortar la red, reproducir y adelantar) y prueba a mano en Android.

---

## Estado y cómo retomar (30-09-2026)

Hechas las fases 0 a 6. Todo con tests: `pnpm check` (unitarios, lint, formato y tipos) y `pnpm test:integration` (la API contra Postgres y Redis reales).

**Levantar el entorno**

```bash
pnpm db:up                       # Docker Desktop abierto primero
pnpm dev                         # app :5173, API :3000/api/v1 (OpenAPI en /api/docs) y worker
pnpm seed:public --audio none    # biblioteca pública desde el corpus (pnpm corpus:download)
```

La base de desarrollo quedó limpia al cerrar la fase 6: sin cuentas de prueba, con Marianela en la biblioteca pública (sin audio). Para probar la app, crea una cuenta desde el pergamino y sube un EPUB del corpus en `/estudio`.

**Dónde está cada cosa**

| Tema                                                               | Archivo                                                                                                                                               |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contratos de la API (endpoints, errores, flujos)                   | `docs/lectio-arquitectura-api.md`                                                                                                                     |
| Decisiones de diseño de la app (salas, lector, reproductor, costo) | `docs/lectio-frontend.md` §2.3                                                                                                                        |
| Temas pixel y el taller                                            | `docs/lectio-temas.md`                                                                                                                                |
| Backend (módulos hexagonales)                                      | `packages/core/src/modules/*`                                                                                                                         |
| La app                                                             | `apps/web/src`: `api/`, `app/`, `auth/`, `library/`, `reader/` (lector), `player/` (reproductor), `screens/`, `theme/` (portado de la CLI), `styles/` |

**Hecho en la etapa 3**: el lector (`screens/Reader.tsx`, `reader/`) con capítulos por demanda (ETag), imágenes con token, notas, índice, tamaño y fuente (menú "Aa"), modo revisión reducido (tacha lo que no se narra: la API no expone el texto narrado) y la pestaña Reporte (`?vista=reporte`). La posición se guarda en el navegador y, con sesión, en el servidor (`reader/position.ts`: cada 10 s y al ocultar o cerrar, con `keepalive`). El reproductor es un único `<audio>` para toda la app (`player/controller.ts`, store de Zustand; en desarrollo, `window.lectio.player` desde la consola): voces con muestra, cambio de voz al empezar la oración siguiente, generar con la línea de cuota y confirmación sobre el 5 %, adelanto del siguiente al 70 % si es barato, avance automático, Media Session, volumen y el taller con el done/total real. La sincronización usa también `timeupdate`, porque `requestAnimationFrame` se detiene con la pestaña oculta (el `preview.js` de la CLI tiene ese mismo problema). Fuera del lector, el mini reproductor al pie de las salas (`player/MiniPlayer.tsx`). "Cap. X de Y" cuenta solo capítulos narrativos (`chapterNumber` en `GET /books`). El botón de la cuenta lleva una llave.

**Pipeline v2**: en español, la vocal acentuada suelta de la ortografía antigua ("á", "é", "ó") se narra sin tilde (Edge la deletreaba). Los libros ya guardados siguen con la narración de la v1 hasta que exista el reprocesamiento (se trabaja aparte).

**Siguiente**: la fase 7, etapa 2 (descargas). La etapa 1 dejó la base PWA: Service Worker propio (`apps/web/src/sw/sw.ts`, Workbox con `injectManifest`), manifest e íconos (`pnpm --filter @lectio/web icons`), `src/pwa/` (conexión, instalar, aviso de versión nueva y la caché de las salas en IndexedDB) y la sesión que sin red sigue con la cuenta de este navegador. El Service Worker solo existe en el build: se prueba con `pnpm --filter @lectio/web preview:pwa` (:4174, con la API por proxy). En el panel del navegador de Claude no se puede cortar la red: se detiene el servidor y se simula con `dispatchEvent(new Event('offline'))`.

**Probar a mano (con el entorno arriba)**: el panel del navegador de Claude no pinta ni corre animaciones si está oculto y frena los temporizadores de la página (a 1 s o más): los tiempos medidos ahí no sirven; hay que mirar en vivo.

**Pipeline cerrado**: la prueba de oído en español no encontró errores que pidan reglas nuevas; lo aprendido quedó en `docs/lectio-pipeline-limpieza.md` y se borró su plan.

## Riesgos conocidos

- **NestJS 12 con ESM y Prisma 7:** Prisma 7 cambió su generador (cliente sin motor de Rust y _driver adapters_), y NestJS nació en CommonJS. Se verifica en la fase 0, antes de construir encima.
- **Docker en Windows:** Docker Desktop tiene que estar abierto para desarrollar y para los tests de integración. Si molesta, el plan B es Postgres y Redis en la nube (Neon y Upstash) solo cambiando el `.env`.
- **Edge TTS en el worker:** es el mismo servicio no oficial de la CLI (`docs/lectio-decision-tts.md` §2). El limitador global y los reintentos por unidad son la defensa; el adaptador de Kokoro sigue fuera de esta etapa.
