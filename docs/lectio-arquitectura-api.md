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
│   └── web/                 # Frontend
├── packages/
│   ├── core/                # módulos de dominio + aplicación, compartidos por api y worker
│   ├── epub-pipeline/       # pipeline de procesamiento de EPUB (lógica pura, sin NestJS)
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
   → guarda Chapter[] (content_html, sentences, notes, kind, character_count)
   → actualiza Book: status = "ready", nav_source, pipeline_version, processing_report
   → si falla: status = "error" con error_code (DRM_PROTECTED, INVALID_ARCHIVE...)
```

```
Flujo de generación de audio:

Usuario → POST /chapters/:id/audio
   → verifica acceso al libro (propietario) y que no sea un libro público (403)
   → si ya existe audio "ready" → 409; si está pending/processing → 200 con el estado actual
   → transacción con bloqueo por usuario:
       · segmentos pending/processing del usuario < N  (si no → 429 AUDIO_CONCURRENCY_LIMIT)
       · character_count ≤ quota − consumed − reserved  (si no → 429 TTS_QUOTA_EXCEEDED)
       · crea AudioSegment (status = "pending", reserved_characters = character_count)
   → encola job en "audio-generation" con { audioSegmentId }
   → responde 202 Accepted con el estado y la cuota restante

Worker (audio-generation):
   → status = "processing"
   → agrupa sentences[].narration en chunks de hasta maxChunkChars
   → por cada chunk: TtsProvider.synthesize (el router elige el proveedor)
       · fallo de un chunk → se reintenta ese chunk, no el capítulo
   → concatena el audio y calcula la alineación por oración
   → sube audio + alignment.json (FileStorage)
   → transacción: AudioSegment "ready" (audio_url, alignment_url, duration_ms, provider)
                  + TtsUsageLog + incremento de User.total_characters_processed
   → fallo definitivo (tras 3 reintentos): status = "error"; la reserva se libera sola,
     porque deja de estar en pending/processing
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

Las URLs de audio de libros privados se sirven como URLs firmadas de corta duración (ej. 1 h) desde el storage, no como URLs públicas permanentes (RNF-02).

**Requisitos del storage para el reproductor** (`lectio-frontend.md` §6.3):
- Soportar peticiones `Range` y responder `206 Partial Content` (necesario para adelantar y retroceder). R2 y S3 lo soportan de forma nativa; el adaptador local de desarrollo debe implementarlo (`@nestjs/serve-static` o `express.static` ya lo hacen).
- Cabeceras CORS que permitan al Service Worker del frontend leer y cachear el audio (`Access-Control-Allow-Origin` con el dominio del frontend y exposición de `Content-Range`, `Accept-Ranges`, `Content-Length`).

### 1.8 Rate limiting

`@nestjs/throttler` global (ej. 100 solicitudes/min por usuario o IP) y reglas más estrictas en:
- `POST /auth/login` y `POST /auth/register`: ej. 5/min por IP (fuerza bruta).
- `POST /books`: ej. 10/hora por usuario.
- `POST /chapters/:id/audio`: ej. 10/min por usuario (la cuota y la concurrencia son el control real; esto frena scripts).

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

El contenido de un capítulo solo cambia si el libro se reprocesa (`pipeline_version`). `GET /chapters/:id` responde con:
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
// Errores: 409 si el correo ya existe
```

**`POST /api/v1/auth/login`**
```json
// Request
{ "email": "string", "password": "string" }
// Response 200
{ "accessToken": "string", "expiresIn": 900, "user": { "id": "uuid", "email": "string" } }
// Además: Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth
// Errores: 401 credenciales inválidas
```

**`POST /api/v1/auth/refresh`**: renueva la sesión (usa la cookie, sin cuerpo)
```json
// Response 200
{ "accessToken": "string", "expiresIn": 900 }
// Además: Set-Cookie con el nuevo refresh token (rotación)
// Errores: 401 si la cookie falta, expiró, fue revocada o reutilizada
```

**`POST /api/v1/auth/logout`**: cierra la sesión actual
```
Response 204
Revoca el refresh token de la cookie y la borra (Set-Cookie con Max-Age=0).
```

### 2.2 Books

**`POST /api/v1/books`**: sube un EPUB (autenticado)
```
Content-Type: multipart/form-data
file: <archivo.epub>

Response 202
{ "id": "uuid", "status": "pending" }

Errores:
413 archivo demasiado grande
409 { "code": "BOOK_ALREADY_EXISTS", "bookId": "uuid" }  el usuario ya subió este mismo archivo
```

**`GET /api/v1/books`**: biblioteca personal (autenticado)
```json
// Response 200
[
  {
    "id": "uuid",
    "title": "string",
    "author": "string",
    "coverUrl": "string",
    "status": "ready",
    "errorCode": null,
    "progress": { "chapterOrder": 3, "totalChapters": 12, "mode": "listening" }
  }
]
```

**`GET /api/v1/books/public`**: biblioteca pública (sin autenticar)
```json
// Response 200
[
  { "id": "uuid", "slug": "don-quijote", "title": "string", "author": "string", "coverUrl": "string", "language": "es" }
]
```

**`GET /api/v1/books/public/:slug`**: detalle de un libro público por su slug (sin autenticar)
```
Response 200: mismo cuerpo que GET /books/:id
Errores: 404 si no existe un libro público con ese slug
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
      "parentTitle": "Parte I",
      "kind": "narrative",
      "characterCount": 18450,
      "audioStatus": "ready"
    }
  ]
}
// audioStatus: none | pending | processing | ready | error
// Por defecto el cliente muestra solo kind = "narrative"; el resto queda disponible.
// Errores: 403 si el libro es privado y no pertenece al usuario autenticado
```

**`GET /api/v1/books/:id/report`**: reporte de procesamiento (autenticado, propietario)
```json
// Response 200: processing_report tal como lo guarda el pipeline (ver pipeline §6)
```

**`DELETE /api/v1/books/:id`**: elimina un libro propio con sus capítulos, audios y progreso (autenticado)
```
Response 204
Errores: 403 si no es el propietario; 409 si tiene audio en pending/processing
```

### 2.3 Chapters

**`GET /api/v1/chapters/:id`**: contenido de un capítulo (mismo control de acceso que el libro)
```json
// Response 200
{
  "id": "uuid",
  "orderIndex": 1,
  "title": "string",
  "parentTitle": "string | null",
  "contentHtml": "<p data-b=\"0\">...</p>",
  "sentences": [
    { "index": 0, "blockIndex": 0, "start": 0, "end": 84 }
  ],
  "notes": [
    { "id": "fn3", "html": "<p>...</p>" }
  ]
}
// El texto a narrar (narration) no se expone: es un detalle interno del TTS.
// Cabeceras: ETag y Cache-Control: private, no-cache (ver §1.11).
// Response 304 sin cuerpo si If-None-Match coincide con el ETag actual.
```

### 2.4 Audio

**`POST /api/v1/chapters/:id/audio`**: solicita la generación de audio de **un** capítulo (autenticado, propietario)
```json
// Request (opcional; si se omite, voz por defecto según el idioma del libro)
{ "voiceId": "es-ES-AlvaroNeural" }

// Response 202
{
  "chapterId": "uuid",
  "status": "pending",
  "quota": { "remaining": 181550 }
}

// Response 200: ya había una solicitud pending/processing para ese capítulo (idempotente)
{ "chapterId": "uuid", "status": "processing" }
```

Errores:
```json
// 409: ya existe audio "ready" para ese capítulo
{ "statusCode": 409, "code": "AUDIO_ALREADY_EXISTS", "message": "..." }

// 429: límite de capítulos simultáneos (RF-24)
{ "statusCode": 429, "code": "AUDIO_CONCURRENCY_LIMIT", "message": "...", "limit": 2 }

// 429: cuota mensual insuficiente (RF-23)
{
  "statusCode": 429,
  "code": "TTS_QUOTA_EXCEEDED",
  "message": "...",
  "required": 18450,
  "remaining": 4210,
  "resetsAt": "2026-10-01T00:00:00Z"
}

// 403: el libro es público (su audio lo genera el sistema)
```

**`GET /api/v1/chapters/:id/audio`**: estado y resultado (mismo control de acceso que el libro)
```json
// Response 200
{
  "status": "ready",
  "audioUrl": "string (URL firmada si el libro es privado)",
  "alignmentUrl": "string",
  "durationMs": 245310,
  "provider": "edge"
}
// status: none | pending | processing | ready | error
```

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
// Errores: 400 si sentenceIndex está fuera de rango para ese capítulo,
//          o si clientUpdatedAt está más de 5 min en el futuro respecto al servidor
```

`clientUpdatedAt` es el momento en que el usuario estuvo realmente en esa posición, no el momento del envío: un progreso guardado sin conexión en el gym y enviado horas después no pisa lo que se leyó entretanto en el computador (`lectio-frontend.md` §6.4). Gana el `clientUpdatedAt` más reciente.

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
  "periodStart": "2026-09-01T00:00:00Z",
  "resetsAt": "2026-10-01T00:00:00Z",
  "quota": 300000,
  "consumed": 99790,
  "reserved": 18660,
  "remaining": 181550,
  "totalCharactersProcessed": 84213
}
```

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
