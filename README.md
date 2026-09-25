# Lectio

Biblioteca personal de EPUB que entiende la estructura del libro y permite alternar entre leerlo y escucharlo con voz neuronal, desde la misma oración.

> Estado: en desarrollo. Hoy es un **pipeline de procesamiento de EPUB con una CLI**: inspecciona un libro, genera su audio por capítulo y lo muestra en un preview web con reproductor sincronizado. La app completa (API, worker y PWA) está diseñada en [`docs/`](docs/README.md).

## Probar la demo en 5 minutos

Requisitos: **Node 24 o superior** y **pnpm 10** (viene con Node vía Corepack). Funciona en Windows, macOS y Linux. Para generar audio hace falta conexión a internet.

```bash
git clone https://github.com/1Zamuken1/lectio.git
cd lectio
corepack enable          # activa pnpm, si no lo tienes instalado
pnpm install
pnpm corpus:download     # descarga 8 libros de dominio público (~10 MB) a corpus/
```

Luego, con un libro del corpus:

```bash
pnpm lectio inspect corpus/pg-marianela.epub                   # estructura del libro en la terminal
pnpm lectio narrate corpus/pg-marianela.epub --chapters 4-5    # audio de los capítulos 1 y 2 (~1 min)
pnpm lectio preview corpus/pg-marianela.epub --open            # abre el libro en el navegador
```

En el preview:

- **▶ en la barra inferior** reproduce el capítulo y resalta la oración que suena.
- **Clic en cualquier oración** → "Escuchar desde aquí".
- **◉ Modo revisión** marca qué se narra, qué se omite (números de página, notas, citas…) y qué cambia; clic en una oración muestra exactamente qué dirá la voz.
- **Reporte** (pestaña superior): clasificación de cada sección, reglas de limpieza aplicadas y costo estimado del audio por proveedor.

También sirve con **tus propios EPUB** (sin DRM): cambia la ruta por la de tu archivo.

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm lectio inspect <libro.epub> [--json]` | Estructura: secciones, tipo (narrativa, preliminar, final, notas), caracteres a narrar y reglas aplicadas. |
| `pnpm lectio narrate <libro.epub> [--chapters 4-6,9] [--voice <voz>]` | Genera un MP3 y su alineación por capítulo en `out/<libro>/audio/`, más `playlist.m3u`. Reanudable: lo ya generado se salta. Los números son los de la columna `#` de `inspect`; sin `--chapters`, narra todos los capítulos narrativos. |
| `pnpm lectio preview <libro.epub> [--open]` | Genera `out/<libro>/preview.html`: una página autocontenida con el libro, el reproductor (si hay audio) y el reporte. |
| `pnpm lectio voices [es\|es-CO\|en-GB…]` | Lista las voces disponibles. Por defecto: `es-CO-GonzaloNeural` en español y `en-US-AndrewNeural` en inglés. |
| `pnpm serve` | Sirve `out/` en http://localhost:4173 (alternativa a `--open`, con soporte para adelantar el audio). |

El audio se genera con **Edge TTS**, un servicio gratuito pero no oficial de Microsoft (sin SLA). Está detrás de una interfaz para poder cambiarlo por otro proveedor; ver [`docs/lectio-decision-tts.md`](docs/lectio-decision-tts.md).

## Estructura

```
apps/cli/                 CLI: inspect, narrate, preview, voices (y el cliente del preview en assets/)
packages/epub-pipeline/   Pipeline de procesamiento: lógica pura, sin red ni disco
corpus/                   Libros de referencia para pruebas (se descargan, no se versionan)
docs/                     Documentación del proyecto
scripts/                  Descarga del corpus y servidor estático para out/
```

El pipeline convierte un EPUB en capítulos listos para leer y narrar en 11 etapas: contenedor y DRM, paquete, índice, segmentación, clasificación, limpieza, oraciones, limpieza de narración, normalización, fragmentos para el TTS y alineación. Detalle en [`docs/lectio-pipeline-limpieza.md`](docs/lectio-pipeline-limpieza.md).

## Desarrollo

```bash
pnpm check     # lint + formato + typecheck + tests (incluye tests sobre el corpus si está descargado)
pnpm build
pnpm --filter @lectio/epub-pipeline golden:update   # tras un cambio intencional en las reglas
```

Los tests del corpus (`packages/epub-pipeline/test/corpus/`) se saltan solos si no se descargó el corpus. Los *golden files* (`test/golden/`) guardan la estructura y la narración de referencia de cada libro: un cambio en las reglas aparece como un diff legible.
