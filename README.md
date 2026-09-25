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

Luego, prepara un libro del corpus y abre Lectio:

```bash
pnpm lectio preview corpus/pg-marianela.epub   # prepara el libro para leerlo en el navegador
pnpm serve                                      # abre Lectio en http://localhost:4173
```

En http://localhost:4173 está la biblioteca: elige un mundo, pulsa **Pulsa para comenzar** y abre el libro. El audio se genera desde el reproductor, sin comandos.

En el libro:

- **Generar con Gonzalo** (barra inferior) crea el audio del capítulo en unos segundos; luego **▶** lo reproduce y resalta la oración que suena.
- **Botón de voz** (junto a la velocidad): Gonzalo, Jorge, Salomé o Salomé grave, cada una con **▶** para escuchar una muestra. Si el capítulo no existe con esa voz, se genera en el momento (el siguiente, por adelantado) y sigue desde la misma oración.
- **Clic en cualquier oración** → "Escuchar desde aquí".
- **◉ Modo revisión** marca qué se narra, qué se omite (números de página, notas, citas…) y qué cambia; clic en una oración muestra exactamente qué dirá la voz.
- **Reporte** (pestaña superior): clasificación de cada sección, reglas de limpieza aplicadas y costo estimado del audio por proveedor.

También sirve con **tus propios EPUB** (sin DRM): cambia la ruta por la de tu archivo. Para inspeccionar o narrar desde la terminal, ver los comandos.

## Comandos

| Comando                                                               | Qué hace                                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lectio inspect <libro.epub> [--json]`                           | Estructura: secciones, tipo (narrativa, preliminar, final, notas), caracteres a narrar y reglas aplicadas.                                                                                                                                                                                        |
| `pnpm lectio narrate <libro.epub> [--chapters 4-6,9] [--voice <voz>]` | Lo mismo que el botón del reproductor, desde la terminal: un MP3 y su alineación por capítulo en `out/<libro>/audio/<voz>/`, más `playlist.m3u`. Reanudable: lo ya generado se salta. Los números son los de la columna `#` de `inspect`; sin `--chapters`, narra todos los capítulos narrativos. |
| `pnpm lectio preview <libro.epub> [--open]`                           | Genera `out/<libro>/preview.html`: una página autocontenida con el libro, el reproductor (si hay audio) y el reporte. Deja también `book.json` y la portada para la biblioteca.                                                                                                                   |
| `pnpm lectio library [carpeta]`                                       | Genera `out/index.html`: la portada (elección de mundo) y la estantería con los libros que tienen preview. `preview` la actualiza sola.                                                                                                                                                           |
| `pnpm lectio voices [idioma]`                                         | Lista las voces: los perfiles de Lectio (`gonzalo` por defecto, `jorge`, `salome`, `salome-grave`), que leen narración y diálogo con tonos distintos, y las voces de Edge. Filtra por idioma o región (`es`, `es-CO`, `en-GB`). En inglés, por defecto `en-US-AndrewNeural`.                      |
| `pnpm serve [--port 4173]`                                            | Abre Lectio en http://localhost:4173: biblioteca, libros y reproductor. Desde el reproductor se elige la voz y se genera el audio que falte. Solo escucha en tu equipo.                                                                                                                           |

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

Los tests del corpus (`packages/epub-pipeline/test/corpus/`) se saltan solos si no se descargó el corpus. Los _golden files_ (`test/golden/`) guardan la estructura y la narración de referencia de cada libro: un cambio en las reglas aparece como un diff legible.
