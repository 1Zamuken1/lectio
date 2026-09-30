# Lectio — Arquitectura Técnica y Contratos de API

> Versión alineada con `lectio-pipeline-limpieza.md`, `lectio-decision-tts.md` y `lectio-modelo-datos.md`.

## Parte 1: Arquitectura

### 1.1 Enfoque general

Arquitectura hexagonal (puertos y adaptadores) aplicada por módulo de dominio. Cada módulo separa:

- **`domain/`**: entidades de dominio, interfaces de puertos (contratos), lógica de negocio pura. Sin dependencias de NestJS ni de librerías externas.
- **`application/`**: casos de uso (services que orquestan el dominio), DTOs de entrada/salida.
- **`infrastructure/`**: adaptadores concretos: controladores HTTP, repositorios Prisma, clientes de TTS, cliente de storage, procesadores de cola (BullMQ).

Es el mismo principio de Spring de separar "puerto" (interfaz) de "adaptador" (implementación), aplicado en TypeScript.

### 1.2 Estructura del monorepo

```
lectio/
├── apps/
│   ├── api/                 # NestJS: solo HTTP, encola jobs
│   ├── worker/              # NestJS (application context, sin HTTP): consume colas
│   ├── cli/                 # CLI: inspect, preview, narrate, serve (uso local y sin conexión)
│   └── web/                 # Frontend
├── packages/
│   ├── core/                # módulos de dominio + aplicación + adaptadores; prisma/ con el esquema
│   ├── epub-pipeline/       # pipeline de procesamiento de EPUB (lógica pura, sin NestJS)
│   ├── tts/                 # Edge TTS, perfiles de voz y montaje MP3 (Node puro, sin NestJS)
│   └── shared/              # DTOs y tipos compartidos con web
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

`api` y `worker` son dos puntos de entrada sobre el mismo código de dominio (`packages/core`). Cada uno registra solo los adaptadores de infraestructura que necesita: `api` los controladores HTTP; `worker` los processors de BullMQ y los clientes de TTS.

### 1.3 Módulos del sistema

```
packages/core/src/modules/
├── auth/
│   ├── domain/              # entidad RefreshToken, puertos de hashing y emisión de tokens
│   ├── application/         # Register, Login, RefreshSession (rotación), Logout
│   └── infrastructure/
├── books/
│   ├── domain/              # entidad Book, puerto BookRepository
│   ├── application/         # UploadBookUseCase, ListLibraryUseCase, DeleteBookUseCase...
│   └── infrastructure/
│       ├── http/            # BooksController (se registra en api)
│       ├── persistence/     # PrismaBookRepository
│       └── queue/           # BookProcessingProcessor (se registra en worker), usa epub-pipeline
├── chapters/
│   ├── domain/              # entidad Chapter, puerto ChapterRepository
│   ├── application/
│   └── infrastructure/
├── audio/
│   ├── domain/              # entidad AudioSegment, puerto TtsProvider, chunking y alineación
│   ├── application/         # RequestAudioGenerationUseCase (cuota y concurrencia)
│   └── infrastructure/
│       ├── http/
│       ├── persistence/
│       ├── tts/
│       │   ├── edge-tts.adapter.ts        # implementa TtsProvider
│       │   ├── kokoro-deepinfra.adapter.ts
│       │   └── tts-provider.router.ts     # implementa TtsProvider, circuit breaker
│       └── queue/           # AudioGenerationProcessor (BullMQ)
├── reading-progress/
├── tts-usage/               # cálculo de cuota y consumo del periodo
└── storage/                 # módulo transversal
    ├── domain/              # puerto FileStorage
    └── infrastructure/      # adaptador local (dev) / R2 (prod)
```

**Regla de dependencia:** `infrastructure` depende de `application`, que depende de `domain`. Nunca al revés. `packages/epub-pipeline` no depende de nada del proyecto: es una librería pura que el processor de libros invoca.

### 1.4 Puertos clave (interfaces de dominio)

```typescript
// modules/audio/domain/ports/tts-provider.port.ts
export interface TtsProvider {
  readonly name: string;           // 'edge' | 'kokoro' | ...
  readonly maxChunkChars: number;  // Edge ~3.000, Kokoro ~1.500
  synthesize(input: {
    text: string;
    voiceId: string;
    language: string;
  }): Promise<{
    audio: Buffer;                 // formato común acordado (ej. MP3 24 kHz mono)
    durationMs: number;
    boundaries: Array<{            // vacío si el proveedor no entrega marcas
      textOffset: number;
      textLength: number;
      audioOffsetMs: number;
    }>;
  }>;
}

// modules/storage/domain/ports/file-storage.port.ts
export interface FileStorage {
  upload(key: string, buffer: Buffer, contentType: string): Promise<string>; // retorna URL
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

// modules/books/domain/ports/book-repository.port.ts
export interface BookRepository {
  save(book: Book): Promise<Book>;
  findById(id: string): Promise<Book | null>;
  findByOwner(ownerId: string): Promise<Book[]>;
  findByOwnerAndHash(ownerId: string, sourceHash: string): Promise<Book | null>;
  findPublic(): Promise<Book[]>;
  delete(id: string): Promise<void>;
}
```

Los puertos se inyectan vía tokens de NestJS (`@Inject('TTS_PROVIDER')`). El binding concreto del token `TTS_PROVIDER` es `TtsProviderRouter`, que a su vez recibe los adaptadores de Edge y Kokoro: el dominio no sabe cuántos proveedores hay detrás. Cambiar de proveedor implica escribir un adaptador y cambiar la configuración del router, con cero cambios en `application` o `domain`.

### 1.5 Colas (BullMQ + Redis)

Dos colas separadas, cada una con su propio processor:

| Cola | Job | Disparado por | Actualiza |
|---|---|---|---|
| `book-processing` | Pipeline completo del EPUB (etapas 1–9) | Subida de un libro (RF-03 a RF-06, RF-13 a RF-16) | `Book.status`, `Book.processing_report`, crea `Chapter[]` |
| `book-processing` (job `reprocess`) | El mismo pipeline sobre un libro ya listo, con la versión actual | `pnpm reprocess:books` (proceso interno) | `Chapter[]` en su lugar, `Book.pipeline_version`; marca obsoleto el audio cuya narración cambió |
| `audio-generation` | Chunking, síntesis y alineación de un capítulo (etapas 10–11) | Solicitud de audio (RF-10 a RF-12, RF-22 a RF-24) | `AudioSegment`, `TtsUsageLog`, `User.total_characters_processed` |

**Por qué colas separadas:** tienen perfiles de carga distintos. Parsear un EPUB es rápido y local; sintetizar audio depende de un servicio externo y puede fallar o reintentar. Separarlas evita que un cuello de botella en TTS bloquee el procesamiento de libros nuevos.

**Limitador global (RNF-07):** el processor de `audio-generation` se configura con `concurrency` (ej. 2–4) y `limiter: { max, duration }` de BullMQ. Es la garantía de que el proveedor nunca recibe más carga de la configurada, sin importar cuántos usuarios soliciten audio.

```
Flujo de subida de libro:

Usuario → POST /books (multipart)
   → valida tamaño y extensión
   → calcula source_hash; si el usuario ya tiene ese libro → 409 con el id existente
   → guarda el archivo (FileStorage)
   → crea Book (status = "pending") y encola job en "book-processing"
   → responde 202 Accepted

Worker (book-processing):
   → descarga el EPUB (FileStorage)
   → processEpub(buffer) de packages/epub-pipeline:
       validación y DRM → OPF → navegación → segmentación → clasificación
       → limpieza estructural → oraciones → limpieza de narración → normalización
   → sube la portada y las imágenes de los capítulos (FileStorage: books/<id>/cover.*, books/<id>/resources/<hash>.*)
   → en una transacción: reemplaza Chapter[] (content_html, sentences con sus tramos de voz, notes, kind, character_count)
   → actualiza Book: status = "ready", nav_source, pipeline_version, processing_report
   → si falla: status = "error" con error_code (DRM_PROTECTED, INVALID_ARCHIVE...)
```

```
Flujo de reprocesamiento (libros ready con pipeline_version < PIPELINE_VERSION):

pnpm reprocess:books [--books id,id] [--dry-run] [--inline]
   → lista los libros ready con una versión anterior
   → encola un job "reprocess" por libro (id "reprocess-<libro>-v<versión>": repetirlo no duplica),
     o con --inline lo procesa en el mismo proceso (como seed:public)

Worker (book-processing, job reprocess):
   → el libro sigue "ready" y se puede leer todo el tiempo (no pasa por processing)
   → descarga el EPUB original (source_key) y corre processEpub con la versión actual
       · si falla (PipelineError o sin EPUB): el libro queda como estaba, con su versión
         anterior; se registra en el log y nunca pasa a "error"
   → sube portada e imágenes (claves por hash de la ruta: las mismas se sobrescriben)
   → empareja los capítulos nuevos con los guardados por título, respetando el orden (LCS):
       · misma estructura (mismo orden y títulos): todos conservan su id
       · si no: los emparejados conservan su id; los demás se crean o se quitan
   → transacción con el libro bloqueado (SELECT … FOR UPDATE), que verifica que siga ready
     y con la versión leída (si no, otro proceso se adelantó y no se hace nada):
       · si hay audio pending/processing en un capítulo que se quitaría → se posterga
         (se vuelve a correr el script más tarde)
       · el audio sin huella de narración (anterior a esta función) recibe la de la
         narración guardada, así la comparación con la nueva es justa
       · actualiza en su lugar los capítulos conservados (content_html, sentences,
         narration_hash…); crea los nuevos; mueve el progreso de los quitados al capítulo
         que ocupa su posición (oración 0); borra los quitados (su audio en cascada; el
         TtsUsageLog queda con chapter_id = null, así el consumo del mes no cambia)
       · recorta sentence_index si un capítulo conservado tiene ahora menos oraciones
       · actualiza Book: pipeline_version, metadatos, processing_report
   → borra del storage los archivos del audio de los capítulos quitados
   → libro público: vuelve a encolar como sistema el audio que ya tenía y cuya narración
     cambió (sin cuota; nadie más puede pedirlo). En libros privados no se regenera ni se
     cobra nada solo: el audio queda obsoleto y el usuario lo regenera gratis (§2.4)
```

**Por qué el audio obsoleto se decide por huella y no por versión:** una versión nueva del pipeline suele cambiar pocas oraciones (la regla de la tilde de "ó" toca unos cuantos capítulos de un libro). `Chapter.narration_hash` resume exactamente lo que se envía a TTS (oraciones narradas, su bloque, su narración y sus tramos de voz) y cada `AudioSegment` guarda la huella de las oraciones con que se generó; solo el audio cuya huella difiere queda obsoleto. Corregir el HTML de lectura no obliga a regenerar la voz.

```
Flujo de generación de audio:

Usuario → POST /chapters/:id/audio
   → verifica acceso al libro (propietario) y que no sea un libro público (403)
   → transacción con bloqueo por usuario (SELECT … FROM users … FOR UPDATE):
       · si ya existe audio "ready" con el perfil y la narración vigentes → 409; si está pending/processing → 200
       · si el "ready" quedó obsoleto porque cambió la narración (reprocesamiento): se regenera
         gratis (billable = false, reserved_characters = 0, sin chequeo de cuota; la
         concurrencia sí cuenta)
       · segmentos pending/processing del usuario < N  (si no → 429 AUDIO_CONCURRENCY_LIMIT)
       · character_count ≤ quota − consumed − reserved  (si no → 429 TTS_QUOTA_EXCEEDED)
       · crea AudioSegment (status = "pending", reserved_characters = character_count),
         o reutiliza la fila si estaba en error u obsoleta
   → encola job en "audio-generation" con { audioSegmentId } (si falla, borra la reserva)
   → responde 202 Accepted con el estado y la cuota restante

Worker (audio-generation):
   → status = "processing"
   → arma las unidades de voz (una por oración o tramo de diálogo)
   → por cada unidad: TtsProvider.synthesize con la prosodia del perfil
     (TTS_REQUESTS_PER_CHAPTER a la vez; guarda el progreso done/total como mucho 1 vez/s)
       · fallo de una unidad → se reintenta esa unidad, no el capítulo
   → monta el MP3 con las pausas de Lectio y calcula la alineación exacta por oración
   → sube audio + alignment.json (FileStorage)
   → transacción: AudioSegment "ready" (audio_url, alignment_url, duration_ms, provider,
                  narration_hash de las oraciones que leyó al empezar)
                  + TtsUsageLog + incremento de User.total_characters_processed
                  (solo si se cobra: con solicitante y billable)
   → fallo definitivo (tras AUDIO_JOB_ATTEMPTS intentos): status = "error" con
     reserved_characters = 0; la reserva deja de contar porque sale de pending/processing
```

### 1.6 Separación de procesos (incluida en el MVP)

La API HTTP y los workers de BullMQ corren como **procesos independientes desde el MVP**: `apps/api` solo sirve HTTP (controladores, encola jobs) y `apps/worker` solo consume colas, sin exponer ningún endpoint HTTP.

**Por qué se incluye desde ahora y no se deja para v1.1:**
- Es exactamente el tipo de decisión de arquitectura distribuida que vale la pena mostrar en un portafolio backend: separar I/O (HTTP) de procesamiento pesado (parseo, llamadas a TTS) es una práctica real de sistemas en producción, no una optimización prematura.
- Un pico de trabajo en los workers (varios audios generándose a la vez) no afecta la latencia de la API, porque son procesos distintos compitiendo por recursos distintos.
- El costo es bajo si los puertos están bien definidos: ambos procesos comparten `packages/core`, solo cambia qué se arranca en cada `main.ts`.
- Railway/Render permiten definir varios servicios desde el mismo repo (uno para `api`, otro para `worker`) sin costo adicional relevante a esta escala.

Ambos procesos se conectan a la misma base de datos (Prisma) y al mismo Redis (BullMQ), pero **el worker nunca recibe tráfico HTTP externo**, lo que reduce la superficie de ataque: el proceso que abre archivos subidos por usuarios no está expuesto a internet.

### 1.7 Control de acceso

| Recurso | Libro privado | Libro público |
|---|---|---|
| Leer libro, capítulos, audio y alineación | Solo el propietario (403 para cualquier otro) | Cualquiera, sin autenticación |
| Solicitar audio | Solo el propietario, con cuota | 403 (el audio se genera por el proceso interno) |
| Progreso | Solo el propietario | Cualquier usuario autenticado (su propio progreso) |
| Eliminar | Solo el propietario | No disponible vía API |

Las URLs de audio de libros privados se sirven como URLs firmadas de corta duración (ej. 1 h) desde el storage, no como URLs públicas permanentes (RNF-02). Los libros públicos usan el mismo esquema: así `/media` nunca consulta la base para decidir el acceso, y el enlace sigue siendo cacheable porque su vencimiento se redondea (§2.4).

**Requisitos del storage para el reproductor** (`lectio-frontend.md` §6.3):
- Soportar peticiones `Range` y responder `206 Partial Content` (necesario para adelantar y retroceder). R2 y S3 lo soportan de forma nativa; el adaptador local de desarrollo debe implementarlo (`@nestjs/serve-static` o `express.static` ya lo hacen).
- Cabeceras CORS que permitan al Service Worker del frontend leer y cachear el audio (`Access-Control-Allow-Origin` con el dominio del frontend y exposición de `Content-Range`, `Accept-Ranges`, `Content-Length`).

### 1.8 Rate limiting

`@nestjs/throttler` global (ej. 100 solicitudes/min por usuario o IP) y reglas más estrictas en:
- `POST /auth/login` y `POST /auth/register`: ej. 5/min por IP (fuerza bruta).
- `POST /books`: ej. 10/hora por usuario.
- `POST /chapters/:id/audio`: ej. 10/min por usuario (la cuota y la concurrencia son el control real; esto frena scripts).

En el MVP el contador vive en memoria de cada proceso de la API (una sola instancia). Con varias instancias se pasa a guardarlo en Redis (`@nestjs/throttler` lo soporta con un storage propio).

### 1.9 Sesión: access token + refresh token

Una PWA que se usa a diario no puede pedir login cada vez que expira el token. Esquema:

| Token | Duración | Dónde vive | Uso |
|---|---|---|---|
| Access token (JWT) | Corta (ej. 15 min) | **En memoria** del frontend (nunca en `localStorage`) | Cabecera `Authorization: Bearer` en cada petición. |
| Refresh token (opaco, aleatorio) | Larga (ej. 30 días) | **Cookie `httpOnly`, `Secure`, `SameSite=Strict`**, con `Path=/api/v1/auth` | Solo para obtener un nuevo access token. JavaScript no puede leerla (protección contra XSS). |

- **Rotación:** cada `POST /auth/refresh` invalida el refresh token usado y emite uno nuevo.
- **Detección de reutilización:** si llega un refresh token ya rotado (señal de robo), se revoca toda su familia y el usuario debe iniciar sesión de nuevo.
- En base de datos se guarda solo el **hash** del refresh token (entidad `RefreshToken`, ver modelo de datos).
- `SameSite=Strict` funciona si frontend y API comparten dominio registrable (ej. `app.lectio.dev` y `api.lectio.dev`). Si no, se usa `SameSite=None; Secure` y se exige un encabezado propio (ej. `X-Requested-With`) en `/auth/refresh` como defensa CSRF.

### 1.10 CORS

- Orígenes permitidos: solo el dominio del frontend (y `localhost` en desarrollo), desde configuración. Nunca `*`, porque las peticiones de sesión llevan credenciales.
- `credentials: true` para que el navegador envíe la cookie del refresh token.
- Cabeceras expuestas: `ETag` (capítulos) y las de rango en el audio (§1.7).

### 1.11 Caché HTTP de capítulos

El contenido de un capítulo solo cambia si el libro se reprocesa (`pipeline_version`; los capítulos que se conservan mantienen su id, §1.5). `GET /chapters/:id` responde con:
- `ETag` derivado de `chapterId + pipelineVersion`.
- `Cache-Control: private, no-cache` (el navegador guarda la respuesta, pero la revalida).

Si el cliente envía `If-None-Match` con el mismo `ETag`, la API responde `304 Not Modified` sin cuerpo: el capítulo no se vuelve a descargar.

---

## Parte 2: Contratos de API

Convención: prefijo `/api/v1`, autenticación vía `Authorization: Bearer <jwt>` salvo donde se indique como público.

### 2.1 Auth

**`POST /api/v1/auth/register`**
```json
// Request
{ "email": "string", "password": "string" }
// Response 201
{ "id": "uuid", "email": "string" }
// Errores: 409 EMAIL_TAKEN si el correo ya existe (se compara normalizado: sin espacios y en minúsculas);
//          400 VALIDATION_FAILED con { errors: [{ field, messages }] } (contraseña de 8 a 128 caracteres)
```

**`POST /api/v1/auth/login`**
```json
// Request
{ "email": "string", "password": "string" }
// Response 200
{ "accessToken": "string", "expiresIn": 900, "user": { "id": "uuid", "email": "string" } }
// Además: Set-Cookie: lectio_refresh=...; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth
// Errores: 401 INVALID_CREDENTIALS: el mismo para correo inexistente y contraseña incorrecta
```

**`POST /api/v1/auth/refresh`**: renueva la sesión (usa la cookie, sin cuerpo)
```json
// Response 200
{ "accessToken": "string", "expiresIn": 900 }
// Además: Set-Cookie con el nuevo refresh token (rotación)
// Errores: 401 INVALID_REFRESH_TOKEN si la cookie falta, expiró o se cerró con logout;
//          401 REFRESH_TOKEN_REUSED si era un token ya rotado: se revoca toda su familia.
//          Dos refresh simultáneos con el mismo token: gana uno y el otro cuenta como reutilización,
//          así que el cliente debe serializar la renovación entre pestañas (Web Locks o BroadcastChannel).
```

**`POST /api/v1/auth/logout`**: cierra la sesión actual
```
Response 204
Revoca el refresh token de la cookie y la borra (Set-Cookie con Max-Age=0).
```

**`GET /api/v1/users/me`**: la cuenta de la sesión (autenticado)
```json
// Response 200
{ "id": "uuid", "email": "string", "createdAt": "2026-09-28T15:45:23Z" }
```

Toda ruta exige el access token salvo las marcadas como públicas (auth, salud, voces, `/media` firmado) o con sesión opcional (la biblioteca pública y todo lo que se lee de un libro: detalle, reporte, portada, imágenes, capítulos y estado del audio). El guard global es cerrado por defecto. Con sesión opcional, sin `Authorization` se atiende como anónimo; con un token inválido o vencido responde 401 igual, para que el cliente renueve la sesión en vez de ver la versión anónima sin notarlo. Un anónimo que pide un libro privado recibe 401 (`UNAUTHORIZED`); otra cuenta, 403 (`BOOK_FORBIDDEN`).

### 2.2 Books

**`POST /api/v1/books`**: sube un EPUB (autenticado)
```
Content-Type: multipart/form-data
file: <archivo.epub>

Response 202
{ "id": "uuid", "status": "pending" }

Errores:
400 INVALID_UPLOAD       falta el archivo, no termina en .epub o no es un ZIP (se valida antes de guardarlo)
413 PAYLOAD_TOO_LARGE    supera MAX_UPLOAD_MB (50 por defecto); el archivo llega a memoria, nunca al disco
409 { "code": "BOOK_ALREADY_EXISTS", "bookId": "uuid" }  el usuario ya subió este mismo archivo (SHA-256)
429                      más de 10 subidas por hora desde la misma IP
```

El pipeline corre en el worker, fuera de la petición: el cliente consulta `GET /books/:id` hasta que `status` sea `ready` o `error`. Un error del pipeline (`DRM_PROTECTED`, `INVALID_ARCHIVE`, `NO_TEXT_CONTENT`…) queda en `errorCode` y no se reintenta; un fallo inesperado se reintenta 3 veces y, si persiste, queda como `PROCESSING_FAILED`.

**`GET /api/v1/books`**: biblioteca personal (autenticado): tus libros y los públicos que empezaste a leer
```json
// Response 200
[
  {
    "id": "uuid",
    "title": "string",
    "author": "string",
    "language": "es",
    "coverUrl": "/api/v1/books/<id>/cover",
    "status": "ready",
    "errorCode": null,
    "isPublic": false,
    "slug": null,
    "createdAt": "2026-09-28T15:45:23Z",
    "progress": { "chapterOrder": 3, "totalChapters": 12, "mode": "listening" }
  }
]
// Del más reciente al más antiguo. coverUrl es null si el libro no tiene portada.
// progress es null si aún no empiezas el libro; chapterOrder es el orderIndex del capítulo actual.
```

**`GET /api/v1/books/public`**: biblioteca pública (sesión opcional)
```json
// Response 200: mismos campos que GET /books, ordenados por título; solo libros ready
[
  { "id": "uuid", "slug": "marianela", "title": "Marianela", "author": "Benito Pérez Galdós", "language": "es",
    "coverUrl": "/api/v1/books/<id>/cover", "isPublic": true, "progress": null, "...": "..." }
]
// Con sesión, progress es el del usuario en cada libro; sin sesión, siempre null.
```

Los libros públicos no tienen dueño (`owner_id = null`) y siempre llevan `slug`. No se suben por la API: los carga el script interno `pnpm seed:public`, que publica libros del corpus y encola su audio como sistema (`requested_by = null`: sin reserva, sin cuota y sin `TtsUsageLog`, por la misma cola y con el mismo límite global que el de los usuarios). Correrlo de nuevo no duplica nada: el mismo archivo se reconoce por su SHA-256 y el audio ya listo se salta.

**`GET /api/v1/books/public/:slug`**: detalle de un libro público por su slug (sin autenticar)
```
Response 200: mismo cuerpo que GET /books/:id
Errores: 404 BOOK_NOT_FOUND si no existe un libro público con ese slug
```
Lo usa el prerender del frontend para generar `/libros/:slug` en tiempo de build (`lectio-frontend.md` §2.1).

**`GET /api/v1/books/:id`**: detalle de un libro (autenticado si es privado; sin auth si es público)
```json
// Response 200
{
  "id": "uuid",
  "title": "string",
  "author": "string",
  "language": "es",
  "status": "ready",
  "chapters": [
    {
      "id": "uuid",
      "orderIndex": 1,
      "title": "string",
      "ancestors": ["Parte I"],
      "kind": "narrative",
      "characterCount": 18450,
      "sentenceCount": 612,
      "audio": [
        { "voiceId": "gonzalo", "status": "ready" },
        { "voiceId": "jorge", "status": "processing" }
      ]
    }
  ]
}
// Además los campos de GET /books (coverUrl, errorCode…) y pipelineVersion.
// chapters queda vacío hasta que el libro está ready.
// audio: una entrada por voz pedida para ese capítulo (las que faltan no aparecen).
// Por defecto el cliente muestra solo kind = "narrative"; el resto queda disponible.
// Errores: 403 BOOK_FORBIDDEN si el libro es privado y no es del usuario; 404 BOOK_NOT_FOUND
```

**`GET /api/v1/books/:id/cover`**: la portada (mismo acceso que el libro)
```
Response 200 con Content-Type image/jpeg | image/png | …, Cache-Control: private, max-age=86400
Errores: 404 COVER_NOT_FOUND si el libro no tiene portada
```
Como una etiqueta `<img>` no envía la cabecera `Authorization`, el cliente la pide con `fetch` y la muestra como blob. Con el storage de producción pasa a ser una URL firmada (§1.7), igual que el audio.

**`GET /api/v1/books/:id/report`**: reporte de procesamiento (autenticado, propietario)
```json
// Response 200: processing_report tal como lo guarda el pipeline (ver pipeline §6)
```

**`DELETE /api/v1/books/:id`**: elimina un libro propio con sus capítulos, audios y progreso (autenticado)
```
Response 204
Errores: 403 BOOK_FORBIDDEN si no es el propietario; 409 BOOK_BUSY si tiene audio en pending/processing
```
Borra también sus archivos del storage (EPUB, portada, imágenes y audio).

### 2.3 Chapters

**`GET /api/v1/chapters/:id`**: contenido de un capítulo (mismo control de acceso que el libro)
```json
// Response 200
{
  "id": "uuid",
  "bookId": "uuid",
  "orderIndex": 1,
  "title": "string",
  "ancestors": ["Primera parte"],
  "kind": "narrative",
  "contentHtml": "<p data-b=\"0\">...</p>",
  "sentences": [
    { "index": 0, "blockIndex": 0, "start": 0, "end": 84, "narrated": true }
  ],
  "notes": [
    { "id": "fn3", "html": "<p>...</p>" }
  ]
}
// El texto a narrar (narration) no se expone: es un detalle interno del TTS.
// narrated = false: la oración se muestra pero no se lee en voz alta (por ejemplo, solo símbolos).
// Cabeceras: ETag ("<chapterId>.p<pipelineVersion>") y Cache-Control: private, no-cache (ver §1.11).
// Response 304 sin cuerpo si If-None-Match coincide con el ETag actual (acepta W/ y listas).
// Errores: 403 BOOK_FORBIDDEN, 404 CHAPTER_NOT_FOUND
```

**`GET /api/v1/books/:id/resources?path=OEBPS/img/figura.png`**: imagen de un capítulo
```
// path es la ruta que aparece en el src del HTML del capítulo (la ruta dentro del EPUB).
// Response 200 con el Content-Type de la imagen, Cache-Control: private, max-age=86400,
// X-Content-Type-Options: nosniff y una CSP con sandbox (un SVG del EPUB no ejecuta scripts).
// La clave en el storage se deriva de la ruta: no hay forma de pedir un archivo ajeno al libro.
// Errores: 403 BOOK_FORBIDDEN, 404 RESOURCE_NOT_FOUND
```

### 2.4 Audio

**`POST /api/v1/chapters/:id/audio`**: solicita la generación de audio de **un** capítulo con una voz (autenticado, propietario)
```json
// Request (opcional; si se omite, la voz por defecto del idioma del libro: gonzalo en español)
{ "voiceId": "salome" }

// Response 202: reservado de la cuota y encolado
{
  "chapterId": "uuid",
  "voiceId": "salome",
  "status": "pending",
  "quota": { "remaining": 181550 }
}

// Response 200: ya había una solicitud pending/processing para ese capítulo y esa voz (idempotente)
{ "chapterId": "uuid", "voiceId": "salome", "status": "processing" }
```

Cada voz es un audio distinto (`AudioSegment` por capítulo y voz): cambiar a una voz ya generada es instantáneo, y pedir otra voz cobra de nuevo los caracteres. Si el audio quedó obsoleto (`outdated: true` en el GET), se puede volver a pedir:
- `outdatedReason: "voice"`: cambió el perfil de voz. Regenerarlo se cobra como cualquier solicitud.
- `outdatedReason: "narration"`: el libro se reprocesó y cambió lo que se narra en el capítulo. Es una corrección de Lectio, no consumo del usuario: regenerarlo es **gratis** (`quota.remaining` no baja, no hay `TtsUsageLog`), aunque cuenta para el límite de concurrencia. Si cambiaron las dos cosas, manda `narration`.

Mientras no se regenera, el audio obsoleto se sigue pudiendo escuchar. Si el reprocesamiento cambió la segmentación de oraciones, el resaltado puede no coincidir del todo; con correcciones de narración (como la de la tilde) coincide.

Errores:
```json
// 400: la voz no existe para el idioma del libro
{ "statusCode": 400, "code": "VOICE_NOT_AVAILABLE", "message": "...", "available": ["gonzalo", "jorge", "salome", "salome-grave"] }

// 409: ya existe audio "ready" para ese capítulo con esa voz
{ "statusCode": 409, "code": "AUDIO_ALREADY_EXISTS", "message": "..." }

// 429: límite de capítulos simultáneos (RF-24, AUDIO_MAX_PER_USER)
{ "statusCode": 429, "code": "AUDIO_CONCURRENCY_LIMIT", "message": "...", "limit": 2 }

// 429: cuota mensual insuficiente (RF-23)
{
  "statusCode": 429,
  "code": "TTS_QUOTA_EXCEEDED",
  "message": "...",
  "required": 18450,
  "remaining": 4210,
  "resetsAt": "2026-10-01T00:00:00.000Z"
}

// 403: BOOK_FORBIDDEN (libro ajeno) o PUBLIC_BOOK_AUDIO (su audio lo genera el sistema)
```

**`GET /api/v1/chapters/:id/audio?voice=salome`**: estado y resultado (mismo control de acceso que el libro; sin `voice`, la de por defecto)
```json
// Response 200 (generándose)
{
  "chapterId": "uuid", "voiceId": "salome", "status": "processing",
  "progress": { "done": 42, "total": 180 },
  "audioUrl": null, "alignmentUrl": null, "expiresAt": null,
  "durationMs": null, "provider": null, "outdated": false, "outdatedReason": null
}
// Response 200 (listo)
{
  "chapterId": "uuid", "voiceId": "salome", "status": "ready", "progress": null,
  "audioUrl": "/api/v1/media?key=...&exp=...&sig=...",
  "alignmentUrl": "/api/v1/media?key=...&exp=...&sig=...",
  "expiresAt": "2026-09-28T13:10:00.000Z",
  "durationMs": 245310, "provider": "edge", "outdated": false, "outdatedReason": null
}
// status: none | pending | processing | ready | error
// progress cuenta unidades de voz (oraciones o tramos de diálogo); total es 0 hasta que el worker lo toma.
```

**`GET /api/v1/media?key=&exp=&sig=`**: el MP3 o el `alignment.json`, sin sesión (el permiso va en la URL firmada)
```
// Firma HMAC-SHA256 sobre la clave del storage y el vencimiento (MEDIA_URL_TTL_SECONDS, 1 h por
// defecto). El vencimiento se redondea a ventanas de 10 min: consultar el estado varias veces
// devuelve la misma URL, así el navegador y el Service Worker la pueden cachear.
// Admite Range: 206 Partial Content con Content-Range; 416 si el tramo cae fuera del archivo.
// La clave incluye la versión de la voz: su contenido nunca cambia (Cache-Control: immutable).
// Errores: 403 MEDIA_URL_INVALID (firma alterada u otra clave) o MEDIA_URL_EXPIRED
```

**`GET /api/v1/voices?language=es`**: voces disponibles (público)
```json
[
  { "id": "gonzalo", "name": "Gonzalo", "language": "es", "isDefault": true, "sampleUrl": "/api/v1/voices/gonzalo/sample" },
  { "id": "jorge", "name": "Jorge", "language": "es", "isDefault": false, "sampleUrl": "/api/v1/voices/jorge/sample" }
]
// Sin language, todas. En inglés (sin perfiles propios), la voz de Edge por defecto.
```

**`GET /api/v1/voices/:id/sample`**: muestra de unos segundos con narración y diálogo (público, admite Range). Las genera el worker al arrancar y quedan en el storage; mientras tanto, 404 `VOICE_SAMPLE_NOT_READY`.

### 2.5 Reading Progress

**`PUT /api/v1/books/:id/progress`**: actualiza la posición (autenticado)
```json
// Request
{
  "chapterId": "uuid",
  "sentenceIndex": 143,
  "mode": "listening",
  "clientUpdatedAt": "2026-09-25T09:58:12Z"
}
// Response 200: se guardó
{ "applied": true, "clientUpdatedAt": "2026-09-25T09:58:12Z" }
// Response 200: había un progreso más reciente (de otro dispositivo); no se sobrescribe
{
  "applied": false,
  "current": { "chapterId": "uuid", "sentenceIndex": 201, "mode": "reading", "clientUpdatedAt": "2026-09-25T10:03:40Z" }
}
// Reenviar exactamente la misma posición (un reintento) responde applied: true.
// Errores 400: SENTENCE_OUT_OF_RANGE (incluye sentenceCount), CHAPTER_NOT_IN_BOOK,
//              CLIENT_TIME_IN_FUTURE (más de 5 min adelantado respecto al servidor),
//              VALIDATION_FAILED (formato); 403 BOOK_FORBIDDEN
```

`clientUpdatedAt` es el momento en que el usuario estuvo realmente en esa posición, no el momento del envío: un progreso guardado sin conexión en el gym y enviado horas después no pisa lo que se leyó entretanto en el computador (`lectio-frontend.md` §6.4). Gana el `clientUpdatedAt` más reciente. La comparación se hace dentro del mismo `INSERT … ON CONFLICT DO UPDATE … WHERE`, así que dos dispositivos guardando a la vez no se pisan.

**`GET /api/v1/books/:id/progress`**: posición actual (autenticado)
```json
// Response 200
{ "chapterId": "uuid", "sentenceIndex": 143, "mode": "listening", "clientUpdatedAt": "2026-09-25T09:58:12Z" }
// Response 200 (sin progreso previo)
{ "chapterId": null, "sentenceIndex": 0, "mode": "reading", "clientUpdatedAt": null }
```

Para reanudar en audio, el cliente busca en `alignment.json` la primera oración con `index ≥ sentenceIndex` y usa su `startMs` (pipeline §4.1).

### 2.6 Usage

**`GET /api/v1/users/me/usage`**: consumo de TTS del usuario autenticado (RF-19)
```json
// Response 200
{
  "periodStart": "2026-09-01T00:00:00.000Z",
  "resetsAt": "2026-10-01T00:00:00.000Z",
  "quota": 300000,
  "consumed": 99790,
  "reserved": 18660,
  "remaining": 181550,
  "totalCharactersProcessed": 84213
}
```

- El periodo es el mes calendario en UTC. `consumed` suma `TtsUsageLog` desde `periodStart`; `reserved`, los `reserved_characters` de los segmentos del usuario en `pending`/`processing`; `remaining = quota − consumed − reserved`.
- `quota` es `User.tts_monthly_quota` o, si es null, `TTS_MONTHLY_QUOTA` de la configuración.

### 2.7 Convención de errores

Todas las respuestas de error siguen el mismo formato. `code` es estable y pensado para el frontend (mensajes, traducciones); `message` es legible pero puede cambiar.
```json
{
  "statusCode": 404,
  "code": "BOOK_NOT_FOUND",
  "message": "Book not found",
  "error": "Not Found"
}
```

---

## Frontend

El diseño del cliente (PWA, lector, reproductor, sincronización y modo sin conexión) está en `lectio-frontend.md`. Los cambios que pedía a esta API (su sección 9) ya están incorporados: sesión con refresh token (§1.9), CORS (§1.10), `Range` en el audio (§1.7), caché de capítulos (§1.11), `clientUpdatedAt` en el progreso (§2.5) y slugs para libros públicos (§2.2).
