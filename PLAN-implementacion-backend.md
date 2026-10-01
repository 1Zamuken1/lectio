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

## Estado y cómo retomar (01-10-2026)

Hechas las fases 0 a 6 y las **etapas 1 a 4 de la fase 7** (base PWA, descargas, progreso sin conexión y prerender); el pipeline va en la **v3** y el reprocesamiento de libros está mergeado. Todo con tests: `pnpm check` (unitarios, lint, formato y tipos) y `pnpm test:integration` (la API contra Postgres y Redis reales). Los últimos commits (desde `381122d`) están en `main` sin push.

**Levantar el entorno**

```bash
pnpm db:up                       # Docker Desktop abierto primero
pnpm dev                         # app :5173, API :3000/api/v1 (OpenAPI en /api/docs) y worker
pnpm seed:public --audio none    # biblioteca pública desde el corpus (pnpm corpus:download)
pnpm --filter @lectio/core db:deploy   # si hay migraciones nuevas
pnpm --filter @lectio/web preview:pwa  # la PWA de verdad (build + preview :4174, API por proxy)
```

La API y el worker de `pnpm dev` se reinician solos al cambiar `packages/core`, el pipeline o `packages/tts`. El Service Worker **solo existe en el build** (`preview:pwa`); en `pnpm dev` no hay.

**La base de desarrollo**: solo la cuenta real del usuario, con sus libros (todos en v3), y Marianela en la biblioteca pública (sin audio). Para probar con otra cuenta: crearla con la contraseña de los tests (`apps/api/test/helpers/test-app.ts`) y borrarla al terminar (libro por la API, usuario por SQL). En esa cuenta real queda un capítulo de _Obras escogidas_ con Gonzalo grabado con el texto anterior: sirve para ver "Regenerar gratis".

**Dónde está cada cosa**

| Tema                                                                                       | Archivo                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contratos de la API (endpoints, errores, flujos, audio desactualizado §2.4)                | `docs/lectio-arquitectura-api.md`                                                                                                                                                                                                                                                                                                                                                      |
| Decisiones de la app: salas, lector, reproductor, costo (§2.3) y PWA / sin conexión (§2.4) | `docs/lectio-frontend.md`                                                                                                                                                                                                                                                                                                                                                              |
| Reglas del pipeline (la tilde antigua en la etapa 9)                                       | `docs/lectio-pipeline-limpieza.md`                                                                                                                                                                                                                                                                                                                                                     |
| Temas pixel y el taller                                                                    | `docs/lectio-temas.md`                                                                                                                                                                                                                                                                                                                                                                 |
| Backend (módulos hexagonales)                                                              | `packages/core/src/modules/*`; reprocesar: `books/application/reprocess-book.service.ts` y `apps/worker/src/reprocess-books.ts`                                                                                                                                                                                                                                                        |
| La app                                                                                     | `apps/web/src`: `api/`, `app/`, `auth/`, `library/`, `reader/`, `player/`, `screens/`, `theme/`, `styles/`                                                                                                                                                                                                                                                                             |
| PWA                                                                                        | `apps/web/src/sw/sw.ts` (Service Worker, Workbox `injectManifest`), `apps/web/src/pwa/` (`downloads.ts` descargas, `cache-keys.ts` claves compartidas con el worker, `db.ts` IndexedDB, `persist.ts` caché de las salas, `online.ts` conexión, `install.ts`, `UpdateNotice.tsx`), `vite.config.ts` (manifest), íconos con `pnpm --filter @lectio/web icons` (`scripts/make-icons.mjs`) |

**Hecho hasta ahora en la app (fase 6)**: el lector (`screens/Reader.tsx`, `reader/`) con capítulos por demanda (ETag), imágenes con token, notas, índice, menú "Aa", modo revisión reducido y la pestaña Reporte (`?vista=reporte`). La posición se guarda en el navegador y, con sesión, en el servidor (`reader/position.ts`: cada 10 s y al ocultar o cerrar, con `keepalive`). El reproductor es un único `<audio>` para toda la app (`player/controller.ts`, Zustand; en desarrollo, `window.lectio.player`): voces, cambio de voz al empezar la oración siguiente, generar con la línea de cuota, adelanto al 70 %, avance automático, Media Session, volumen, el taller con el done/total real y el mini reproductor en las salas.

**Hecho hoy**

- **Fase 7, etapa 1 (base PWA)**: app shell y fuentes latinas precargados, portadas en caché, aviso "Nueva versión" (nunca recarga sola), botón "Instalar" y globo del búho en iPhone, ícono (libro que flota sobre una mesa de encantamientos). Sin conexión: las salas muestran la última visita (TanStack Query persistido en IndexedDB), los libros quedan apagados (`.spine.is-offline`) y no se sube, genera, entra, sale ni quita; la sesión sigue con la cuenta de este navegador (`rememberInBrowser` en `api/session.ts`) y se renueva al volver la red.
- **Pipeline v3**: la vocal suelta con cualquier tilde (también la grave y la del anuncio del capítulo) se narra sin tilde; las marcas combinantes cuentan como parte de la palabra ("soñó", "averigüé" no se tocan).
- **Reprocesamiento mergeado** (rama `claude/upbeat-bhabha-45a79e`) y la base de desarrollo reprocesada a v3.
- **Regenerar gratis el audio desactualizado** (`player.regenerate()`, línea bajo el reproductor): sigue sonando el anterior y se cambia al nuevo al empezar la oración siguiente. En el backend, cada grabación tiene su propia clave (voz + momento, en hex: es lo que acepta `/media`), se borran los archivos de la anterior, y una regeneración que falla vuelve a la grabación anterior.

**Hecho el 01-10 (fase 7, etapa 2: descargas)**. Por dentro: `pwa/downloads.ts` (singleton `downloads`; en desarrollo, `window.lectio.downloads`) baja un capítulo con `downloadChapter(api, detalle, capítulo, voz | null)` o `downloadNext(…, 3)`: el JSON, las imágenes, el audio y la alineación a Cache Storage (`lectio-downloads`), y el índice y la ficha a IndexedDB v2. Si algo falla no queda nada a medias. Se borra con `removeChapter`, `removeBook` y `removeAll` (una imagen que usa otro capítulo se conserva); `storageUse()` da el espacio, y `navigator.storage.persist()` se pide al primer uso. El Service Worker sirve `/media` por clave con 206 (`workbox-range-requests`), el capítulo (red primero; la copia sin red o con 5xx) y las imágenes. `useAvailableOffline()` ya es real. Sin worker, `useBookDetail`, `useChapter` y las imágenes del lector caen a lo descargado cuando la API no responde (`networkMode: 'always'`). El reproductor suena desde la descarga sin red, mientras se regraba, o si es la misma grabación que da la API; si la API da otra clave (se regeneró), baja la nueva por detrás. Sin conexión, la voz que suena es una descargada. El lector ya no espera la posición del servidor si la consulta está en pausa. Probado en `preview:pwa` con la API detenida: texto, audio con Range, reproductor y salas.

La interfaz (frontend §2.4, filas "Descargas: …"):

- **Atril** (`library/LecternDownloads.tsx`): ícono al final de cada capítulo (flecha → anillo con el avance real → sello; tocar el sello pregunta si quitar) y "Descargar los próximos 3" bajo Continuar (los próximos 3 que **faltan** desde donde vas). Se baja la voz elegida (`player.downloadVoice`) o solo el texto. La cola baja de a uno (`downloads.state.active`: avance de 0 a 1).
- **Arcón** (`library/DownloadCrew.tsx`, sprites `Pixel.scrollCarrier` y `Pixel.downloadChest`, sonido `chest`): al pie del atril, un aprendiz por capítulo en fila; el primero camina según el avance (mínimo 1,6 s), el arcón se abre, lo guarda y cierra con "clonc". En el celular, en una franja sobre la lista. Clásico o movimiento reducido: solo el anillo y `chest-soft`.
- **Panel "Descargas"** (`library/DownloadsPanel.tsx`, ícono `chest` en la barra de las dos salas con el número de lo que baja): espacio (vela en el Scriptorium, barra en el Clásico), lo descargado por libro, quitar capítulo o libro con "Deshacer" (6 s; lo pendiente se borra al cerrar) y "Borrar todo" con confirmación. Hoja inferior en el celular.
- **Salir** (`components/Topbar.tsx`): si hay descargas de libros privados, avisa y las borra (`downloads.removePrivate`); las públicas se quedan.
- **Lector sin red** (`screens/Reader.tsx`): un capítulo no descargado lo explica y ofrece el descargado más cercano; en el índice, los no descargados se ven apagados. El adelanto del capítulo siguiente usa las mismas opciones que el lector (si no, sin red quedaba en pausa y el lector se colgaba esperándolo).
- **Avance automático sin red** (`player/controller.ts`, `#nextDownloaded`): salta al siguiente con audio descargado; si no hay, búho y "No hay más capítulos descargados."

Probado en `pnpm dev` con Marianela (sin audio): atril, escena (escritorio y celular), panel, Clásico, lector con la red bloqueada; Salir con una cuenta de prueba (borrada después). El audio en el atril y el panel (voz y MB) aún no se vio en pantalla con un libro con audio.

**Hecho el 01-10 (fase 7, etapa 3: progreso sin conexión)**: `ProgressSync` (`reader/position.ts`) encola en IndexedDB v3 (`pwa/progress-queue.ts`, una posición por usuario y libro, la más reciente) lo que no llega a la API, y lo envía al volver la red, al abrir la app y al entrar (`progress.sync()`). Un 4xx descarta; la red caída o un 401 lo dejan para después; el servidor ya se queda con el `clientUpdatedAt` más reciente. `isUnreachable` vive ahora en `api/client.ts`. Tests en `test/progress-sync.test.ts`; probado en el navegador con una cuenta de prueba (borrada): sin red queda en la cola, al recargar o al volver la red llega al servidor.

**Hecho el 01-10 (fase 7, etapa 4: prerender)**: `build/prerender.ts` (plugin de Vite) escribe `/`, `/biblioteca` y `/libros/:slug` con su contenido, etiquetas para buscadores y para compartir, `robots.txt`, `sitemap.xml` y `_redirects` (frontend §2.1). Sin hidratación: React reemplaza el HTML al cargar. El tema se aplica antes de pintar (script en `index.html`) y el Service Worker usa `shell.html` para toda navegación. Variables: `LECTIO_API_URL`, `LECTIO_SITE_URL` y `LECTIO_PRERENDER=required`. `headingMatchesTitle` pasó a `reader/heading.ts` (sin dependencias: la usa el build). Tests en `test/prerender.test.ts`; probado en `preview:pwa`: sin JS se ve como el lector, y React toma el control con el mismo capítulo.

**Siguiente: fase 7, etapa 5**: Playwright sin conexión (descargar, cortar la red, leer y escuchar, progreso que vuelve) y la prueba en un Android real (instalación, sin conexión de verdad, pantalla bloqueada). Antes de Playwright, ver si conviene en CI o solo local.

**Limitaciones conocidas (para decidir más adelante)**

- El aviso de audio desactualizado aparece al dar play, no antes (el reproductor consulta ese audio al cargarlo).
- Mientras se regraba, si se recarga la página o se vuelve al capítulo, la grabación anterior no se puede pedir (el segmento está `pending` y no da URL). Si estaba descargada, sí suena (desde la descarga).
- Sin probar aún en un celular real: instalación, globo de iPhone y sin conexión de verdad (etapa 5).
- Las descargas privadas se borran al tocar Salir; si la sesión vence o se cierra desde otra pestaña, quedan hasta el próximo Salir.
- En el índice sin red, un capítulo que se leyó en esta visita (en la caché de TanStack) se ve apagado aunque se abre.

**Probar a mano con el panel del navegador de Claude**: si está oculto no pinta ni corre animaciones, frena los temporizadores (a 1 s o más) y no carga las imágenes `loading="lazy"`; no se puede cortar la red: se detiene el servidor y se simula con `dispatchEvent(new Event('offline'))`. La oferta de instalación se simula despachando un `beforeinstallprompt` con `prompt()`.

## Riesgos conocidos

- **NestJS 12 con ESM y Prisma 7:** Prisma 7 cambió su generador (cliente sin motor de Rust y _driver adapters_), y NestJS nació en CommonJS. Se verifica en la fase 0, antes de construir encima.
- **Docker en Windows:** Docker Desktop tiene que estar abierto para desarrollar y para los tests de integración. Si molesta, el plan B es Postgres y Redis en la nube (Neon y Upstash) solo cambiando el `.env`.
- **Edge TTS en el worker:** es el mismo servicio no oficial de la CLI (`docs/lectio-decision-tts.md` §2). El limitador global y los reintentos por unidad son la defensa; el adaptador de Kokoro sigue fuera de esta etapa.
