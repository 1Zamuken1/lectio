# Plan de implementación: `epub-pipeline` + CLI

> Documento temporal de trabajo. Se elimina al terminar esta etapa; las decisiones permanentes viven en `docs/`.

## Objetivo

Construir `packages/epub-pipeline` (etapas 1–11 de `docs/lectio-pipeline-limpieza.md`) y una CLI que lo use para **narrar un EPUB real en tu propio computador**:

```bash
lectio inspect libro.epub            # estructura, clasificación y reporte, sin TTS
lectio preview libro.epub            # HTML local para revisar qué se narra y qué se omite
lectio narrate libro.epub --chapters 1-3 --voice es-ES-AlvaroNeural
```

Al final de la etapa hay algo usable a diario (convertir tus EPUB en MP3 por capítulo con buena limpieza) y la pieza central del backend queda probada antes de escribir NestJS.

### Fuera de esta etapa

NestJS, base de datos, colas, auth, frontend, Kokoro (se deja el puerto listo) y la biblioteca pública. La CLI no se despliega en ningún lado.

---

## Decisiones técnicas de arranque

| Tema | Decisión |
|---|---|
| Runtime | Node 24 LTS, TypeScript 6.0 estricto, ESM. (No TS 7: typescript-eslint aún exige `<6.1`.) |
| Monorepo | pnpm workspaces + Turborepo, desde el día 1 (aunque solo haya 2 paquetes). |
| Paquetes de esta etapa | `packages/epub-pipeline` (lógica pura, **sin red ni sistema de archivos**: recibe `Buffer`, devuelve objetos) y `apps/cli` (lee y escribe archivos, contiene el adaptador de Edge TTS). |
| Tests | Vitest. |
| Build | `tsc -p tsconfig.build.json` en ambos paquetes (sin bundler; `tsup` se descartó porque su generación de `.d.ts` falla con TS 6). En desarrollo la CLI corre desde el código fuente con `tsx --conditions=source`. |
| Calidad | ESLint + Prettier + `tsc --noEmit`; todo junto con `pnpm check`. |
| Librerías | `yauzl` (ZIP), `fast-xml-parser` (OPF/NCX), `linkedom` (DOM), `sanitize-html`, `Intl.Segmenter` (nativo), `commander` (CLI), `edge-tts-universal` (TTS; verificar al instalar que expone `WordBoundary`). |
| Audio | MP3 24 kHz mono de Edge (`audio-24khz-48kbitrate-mono-mp3`). Los fragmentos se concatenan a nivel de bytes (mismo códec y bitrate → MP3 válido). La duración sale de las marcas de tiempo, así que **no hace falta ffmpeg**. |
| Fixtures de test | Los EPUB sintéticos se **generan en el test** con un helper `buildEpub({...})` (usando `yazl`), no como binarios versionados: cada test declara exactamente el caso que prueba. |
| Corpus real | Carpeta `corpus/` ignorada por git, poblada con un script `pnpm corpus:download` que descarga desde URLs listadas en `corpus/sources.json`. |

### Estructura objetivo al final de la etapa

```
lectio/
├── docs/
├── apps/
│   └── cli/
│       └── src/
│           ├── commands/        # inspect, preview, narrate
│           ├── tts/             # edge-tts.adapter.ts
│           └── index.ts
├── packages/
│   └── epub-pipeline/
│       ├── src/
│       │   ├── container/       # etapa 1
│       │   ├── package/         # etapa 2
│       │   ├── navigation/      # etapas 3–4
│       │   ├── classification/  # etapa 5
│       │   ├── cleaning/        # etapas 6 y 8, un archivo por regla (S1..S4, N1..N5)
│       │   ├── sentences/       # etapa 7
│       │   ├── normalization/   # etapa 9
│       │   ├── audio/           # chunking y alineación (10–11), sin llamar a TTS
│       │   ├── report/
│       │   ├── types.ts         # ProcessedBook, Chapter, Sentence, TtsProvider...
│       │   └── index.ts         # processEpub(), buildChunks(), buildAlignment()
│       └── test/
│           ├── helpers/build-epub.ts
│           ├── unit/
│           └── golden/
├── corpus/                      # ignorado por git
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

### Contrato público del paquete

```typescript
export function processEpub(file: Buffer, options?: PipelineOptions): Promise<ProcessedBook>;

export interface ProcessedBook {
  metadata: { title: string; authors: string[]; language: string };
  cover?: { mediaType: string; data: Buffer };
  navSource: 'nav' | 'ncx' | 'spine';
  chapters: ProcessedChapter[];
  resources: Map<string, { mediaType: string; data: Buffer }>; // imágenes referenciadas
  report: ProcessingReport;
  pipelineVersion: number;
}

export interface ProcessedChapter {
  orderIndex: number;
  title: string;
  parentTitle: string | null;
  kind: 'narrative' | 'front_matter' | 'back_matter' | 'notes';
  contentHtml: string;
  sentences: Sentence[];
  notes: { id: string; html: string }[];
  characterCount: number; // caracteres de narración
}

export class PipelineError extends Error {
  code: 'INVALID_ARCHIVE' | 'MISSING_PACKAGE' | 'DRM_PROTECTED' | 'NO_TEXT_CONTENT' | 'LIMITS_EXCEEDED';
}
```

Este contrato es el que después consumirá el worker de NestJS sin cambios.

---

## Fases

Cada fase termina con tests en verde y un commit. Las fases 1–7 no usan red.

### Fase 0 — Andamiaje

- [x] `git init`, `.gitignore` (node_modules, dist, corpus, `out/`).
- [x] `package.json` raíz, `pnpm-workspace.yaml`, `turbo.json` con tareas `build`, `test`, `lint`, `typecheck`.
- [x] `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`), ESLint y Prettier.
- [x] `packages/epub-pipeline` y `apps/cli` vacíos, con un test trivial cada uno.
- [x] Helper `buildEpub()` para generar EPUB sintéticos en memoria (EPUB 2 y 3, con o sin nav/NCX).
- [x] `corpus/sources.json` + script de descarga (ver lista abajo).

**Listo cuando:** `pnpm check` pasa desde la raíz. **Hecho** (commit `ef93f42`).

### Fase 1 — Contenedor y paquete (etapas 1–2)

- [x] Apertura del ZIP con límites: tamaño comprimido, descomprimido total, número de entradas, rechazo de rutas con `..`.
- [x] `container.xml` → ruta del OPF; parser XML sin entidades externas.
- [x] Detección de DRM (`encryption.xml` con recursos que no son fuentes, `rights.xml`, `license.lcpl`, `sinf.xml`); la ofuscación de fuentes no cuenta.
- [x] OPF: metadata, manifest, spine (`linear="no"`), portada (3 estrategias).
- [x] Resolución de `href` relativos al OPF, con decodificación de URL (`%20`).

**Tests:** ZIP corrupto, zip bomb sintético, path traversal, EPUB con DRM simulado, EPUB con solo ofuscación de fuentes (debe pasar), EPUB 2 vs 3 para la portada.

**Hecho.** Además de lo previsto: test de humo sobre el corpus (`test/corpus/`), que se salta si no está descargado. Los 8 libros abren en 5–80 ms sin warnings; *The Waste Land* (fuentes ofuscadas) no se detecta como DRM.

**Observaciones para la fase 2:** *Don Quijote* tiene 142 entradas de TOC repartidas en 14 documentos del spine (hasta 21 en un mismo archivo) y *Marianela* 25 entradas en 4 documentos: el corte por fragmento (`#id`) es imprescindible, no un caso raro. Standard Ebooks trae `guide` con `title-page` y `notes`, útil para la fase 3.

### Fase 2 — Navegación y segmentación (etapas 3–4)

- [x] Parser de `nav.xhtml` (`epub:type="toc"`), de NCX y respaldo por spine.
- [x] Aplanado del árbol (umbral de tamaño y profundidad máxima 2, configurables) con `parentTitle`. **Cambio:** la decisión es **por rama**, no un umbral global: un nodo se divide en sus hijos si el tamaño promedio de estos supera el mínimo. La portadilla corta de un grupo se fusiona con su primer hijo.
- [x] Flujo lineal del spine y resolución de cada entrada a `(índice de spine, nodo)`.
- [x] Corte por fragmento (`#id`), anexado de archivos sin entrada propia, sección inicial previa al primer punto, warning `TOC_ORDER_MISMATCH`.

**Tests:** varios capítulos en un archivo, un capítulo en 3 archivos (`_split_`), TOC vacío (respaldo por spine), TOC desordenado, entrada que apunta a un `id` inexistente.

**Hecho.** DOM con `linkedom` en modo XML (en modo HTML, `<a id="x"/>` no se cierra y rompe los cortes), con las entidades HTML (`&nbsp;`) convertidas antes a numéricas. Los 8 libros del corpus se segmentan sin warnings en menos de 350 ms; hay tests de regresión sobre el corpus (126 capítulos en *Don Quijote*, 135 en *Moby-Dick*, rimas de Bécquer sin partir, etc.).

**Observaciones para la fase 3 (clasificación):**
- *Don Quijote* tiene una sección "por Miguel de Cervantes Saavedra" de 12,6k caracteres que en realidad es el **índice HTML** del libro (lista de enlaces). Solo la delata la densidad de enlaces: la heurística de `toc` es imprescindible.
- Los libros de Gutenberg tienen una sección inicial (`leading`) con el encabezado del proyecto y una final "THE FULL PROJECT GUTENBERG LICENSE": hace falta una regla de título para la licencia.
- *Marianela* tiene una entrada "Capítulos:" (134 caracteres) que es el índice; *Moby-Dick* un "Contents" no lineal.
- Standard Ebooks: Titlepage, Imprint, Colophon, Uncopyright con `epub:type` explícito (caso semántico).

### Fase 3 — Clasificación (etapa 5)

- [x] Señales por precedencia: `epub:type`/`role` → landmarks/guide → regex de título (es/en) → heurísticas.
- [x] Marca de confianza baja para las decididas por heurística.

**Tests:** un caso por señal, y un caso de conflicto para verificar la precedencia (título "Notas" pero `epub:type="bodymatter"` → narrativa).

**Hecho.** Precedencia final: tipo semántico específico → landmark exacto → tipo genérico (`frontmatter`/`bodymatter`/`backmatter`) → título → heurísticas → narrativa por defecto. Cambios respecto al diseño:
- Veredicto **auxiliar** (índice, copyright, colofón, agradecimientos): la posición respecto al cuerpo del libro decide si es front o back matter.
- Los tipos se leen en el **ancla** de la entrada del índice, no en el inicio fusionado: sin esto, la portadilla fusionada ocultaba el capítulo I de *Vindication* (17k caracteres).
- En zonas sin entradas de índice, **cada documento es su propia sección** (antes se fusionaban portada + copyright + índice).
- Heurísticas nuevas: aviso legal (©, ISBN) fuera del cuerpo, y preliminares del Siglo de Oro (tasa, fe de erratas) por título.

Resultado en el corpus: índice HTML de *Don Quijote* detectado (99 % en enlaces), encabezados y licencias de Gutenberg, notas de *Waste Land* y *Vindication*, front matter sin marcar de *Accessible EPUB 3*. Test de regresión: ningún capítulo numerado de ningún libro queda fuera de la narración.

### Fase 4 — Limpieza estructural y HTML de lectura (etapa 6)

- [x] Reglas S1 (números de página), S2 (running headers y títulos duplicados), S3 (ocultos), S4 (extracción de notas a `notes[]`).
- [x] Sanitización por lista blanca, reescritura de rutas de imágenes a claves de `resources`, atributo `data-b` por bloque.
- [x] Cada regla reporta cuántos elementos tocó y por qué vía (semántica o heurística).

**Tests:** positivos y negativos por regla (ej. un párrafo que es solo "1984" dentro de una novela no es un número de página si no hay señal adicional).

**Hecho.** Diferencias con lo previsto, todas surgidas del corpus:
- S1 incluye **números de verso** (`<span class="lnum">`, *The Waste Land*): sin esto se narraría "veinte" cada cinco versos. Los marcadores de página de Gutenberg (`x-ebookmaker-pageno`) son spans vacíos a mitad de palabra.
- S4 **copia** las notas de una sección de notas aparte (sin tocarla) y **extrae** las locales. Los enlaces de vuelta con aspecto de llamada (Gutenberg: `[*]` ↔ `[*]`) se distinguen porque su "cuerpo" es otra llamada. Un `<aside>` solo es nota si una llamada lo referencia (los 26 recuadros de *Accessible EPUB 3* se conservan).
- S2b (título duplicado) solo mira los documentos posteriores al ancla: antes eliminaba el encabezado "I" del capítulo cuando delante había una portadilla fusionada.
- Sanitización propia sobre el DOM (lista blanca, sin `sanitize-html`) y serializador HTML propio: el de linkedom en modo XML emite `<br />`. Atributos en orden alfabético (salida determinista para los golden files) y espacios colapsados (el texto del DOM coincide con los offsets de la etapa 7).

Corpus: 352 marcadores de página en Bécquer, 43 números de verso y 50 notas en *Waste Land*, 37 notas en *Vindication*; ningún HTML de lectura con etiquetas o atributos fuera de la lista blanca.

### Fase 5 — Oraciones, narración y normalización (etapas 7–9)

- [ ] Recorrido por bloques, `Intl.Segmenter` por idioma + lista de abreviaturas (es/en).
- [ ] `start`/`end` sobre el `textContent` del bloque; bloques no narrables (tablas, código).
- [ ] Reglas N1–N5, cada una desactivable desde `PipelineOptions`.
- [ ] Normalización: NFC, guiones blandos, capitulares, guiones de división silábica, anuncio de capítulo, romanos en títulos, escape SSML.

**Tests:** los casos negativos del documento de pipeline ("(Madrid, 1605)", "(1984)", "Luis XIV"), abreviaturas ("El Sr. García llegó."), e **invariantes**: `text === blockText.slice(start, end)`, índices contiguos, `narration.length <= text.length` salvo el anuncio.

### Fase 6 — Reporte y comandos `inspect` / `preview`

- [ ] `ProcessingReport` completo (versión, duración, fuente de navegación, conteos por tipo, reglas, warnings, muestras).
- [ ] `lectio inspect libro.epub [--json]`: tabla de capítulos (orden, tipo, título, caracteres de narración) + resumen del reporte.
- [ ] `lectio preview libro.epub`: genera `out/<libro>/preview.html`, un único archivo con el HTML de lectura donde **lo que se narra, lo que se omite y las notas se ven con colores distintos**, más un panel con el reporte. Es la herramienta para calibrar reglas a ojo.

**Listo cuando:** puedes abrir el preview de un libro del corpus y revisar la limpieza sin leer JSON.

### Fase 7 — Golden tests sobre el corpus

- [ ] Descargar el corpus (lista abajo).
- [ ] Por libro, guardar en `test/golden/` la narración de 2–3 capítulos elegidos y el resumen del reporte. Solo se versiona el texto derivado, no los EPUB.
- [ ] Métrica de regresión: porcentaje de caracteres narrados sobre caracteres del cuerpo, por libro, con una tolerancia (ej. ±2 %).
- [ ] Los tests golden se saltan automáticamente si el corpus no está descargado (para que `pnpm test` funcione en un clon limpio).

**Listo cuando:** los 6 libros del corpus se procesan sin errores fatales y revisaste sus previews.

### Fase 8 — Chunking, alineación y `narrate`

- [ ] `buildChunks(sentences, maxChunkChars)` en el paquete: no corta oraciones, prefiere fin de párrafo, divide oraciones gigantes por comas.
- [ ] `buildAlignment(chunks, results)` en el paquete: offsets acumulados → `{ index, startMs, endMs }` por oración, omitiendo las no narradas.
- [ ] Puerto `TtsProvider` en `types.ts` (tal como está en `docs/lectio-arquitectura-api.md` §1.4).
- [ ] `apps/cli/src/tts/edge-tts.adapter.ts`: implementa el puerto, pide `WordBoundary`, `maxChunkChars = 3000`, reintento con backoff por fragmento, concurrencia 2.
- [ ] `lectio narrate libro.epub [--chapters 1-3] [--voice ...] [--out dir]`:
  - por defecto solo capítulos `narrative`;
  - escribe `NN - Título.mp3` + `NN.alignment.json` por capítulo y un `playlist.m3u`;
  - muestra el progreso y los caracteres enviados;
  - reanudable: si el MP3 de un capítulo ya existe, lo salta.
- [ ] Añadir la alineación al `preview`: botón para reproducir el MP3 junto al texto con la oración actual resaltada. Es la primera prueba real de la sincronización.

**Tests:** `buildChunks` y `buildAlignment` con resultados de TTS simulados (incluyendo oraciones con narración vacía y un proveedor sin `boundaries`). El adaptador de Edge se prueba manualmente, no en CI (depende de la red y de un servicio no oficial).

### Fase 9 — Validación de uso real

- [ ] Narrar 3 capítulos de un libro en español del corpus y escucharlos completos.
- [ ] Anotar cada artefacto que se escuche mal (número leído, nota colada, corte raro) → caso de test → corrección.
- [ ] Narrar un libro propio (no del corpus) de principio a fin y usarlo de verdad unos días.
- [ ] Actualizar `docs/lectio-pipeline-limpieza.md` con lo aprendido: umbrales calibrados y reglas que cambiaron.
- [ ] Borrar este plan.

---

## Corpus inicial

| Libro | Fuente | Qué pone a prueba |
|---|---|---|
| Un clásico en inglés con endnotes (ej. *The Adventures of Sherlock Holmes*, u otro con notas) | Standard Ebooks | Caso ideal semántico: todo debe resolverse sin heurísticas. |
| *Don Quijote* (Gutenberg #2000) | Project Gutenberg (EPUB 3) | Español, libro largo, estructura en dos partes (`parentTitle`), marcado pobre. |
| Otro clásico en español (ej. Galdós o Bécquer) | Project Gutenberg | Números de página `pagenum`, notas del editor. |
| Un ensayo o libro de no ficción con citas | Project Gutenberg o Standard Ebooks | Reglas N2–N5 (citas, referencias). |
| Ejemplos de `epub3-samples` (2–3 archivos) | Repositorio IDPF / W3C en GitHub | Casos límite del estándar: nav complejo, notas emergentes. |
| Un documento propio convertido con Calibre (DOCX o PDF → EPUB) | Tú | Archivos `_split_`, running headers, guiones de división silábica. |

---

## Riesgos de la etapa

| Riesgo | Mitigación |
|---|---|
| Edge TTS responde 403 al empezar la fase 8 | Actualizar la librería; si persiste, implementar en la CLI el adaptador de Kokoro vía DeepInfra (el puerto ya existe) y seguir. |
| `linkedom` no cubre algún caso del DOM (ej. `Range` o selectores complejos) | Los offsets se calculan recorriendo nodos de texto, sin depender de `Range`; si algo falta, `parse5` + utilidades propias. |
| Las reglas heurísticas se sobreajustan al corpus | Cada ajuste de regla lleva un caso negativo; la métrica de caracteres narrados detecta regresiones masivas. |
| El alcance crece (más reglas, más idiomas) | Solo español e inglés en esta etapa; lo nuevo va a una lista para después de la fase 9. |

## Definición de terminado

1. `pnpm check` en verde en un clon limpio.
2. Los 6 libros del corpus se procesan sin error fatal; el preview de cada uno revisado.
3. Un libro en español narrado con `lectio narrate`, escuchado, con los artefactos corregidos.
4. `processEpub` expone el contrato de arriba, listo para usarlo desde el worker de NestJS.
