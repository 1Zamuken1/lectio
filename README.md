# Lectio

Biblioteca personal de EPUB que entiende la estructura del libro y permite alternar entre leerlo y escucharlo con voz neuronal, desde la misma oración.

> Estado: en desarrollo. Etapa actual: pipeline de procesamiento de EPUB y CLI.

## Documentación

El diseño completo (producto, mercado, requisitos, datos, API, pipeline, TTS y frontend) está en [`docs/`](docs/README.md).

## Estructura

```
apps/cli/                 CLI: inspeccionar y narrar EPUB en local
packages/epub-pipeline/   Pipeline de procesamiento (lógica pura, sin red ni disco)
corpus/                   Libros de referencia para pruebas (se descargan, no se versionan)
docs/                     Documentación del proyecto
```

## Desarrollo

Requisitos: Node 24+ y pnpm 10+.

```bash
pnpm install
pnpm check              # lint + formato + typecheck + tests
pnpm build
pnpm corpus:download    # descarga el corpus de referencia (opcional)
```

## Probar el pipeline con un libro

```bash
pnpm lectio inspect corpus/pg-marianela.epub          # estructura y reporte en la terminal
pnpm lectio preview corpus/pg-marianela.epub --open   # HTML para revisar en el navegador
```

```bash
pnpm lectio voices es                                        # voces disponibles
pnpm lectio narrate corpus/pg-marianela.epub --chapters 4-5  # MP3 + alineación por capítulo
pnpm lectio preview corpus/pg-marianela.epub --open          # ahora con reproductor
pnpm serve                                                   # sirve out/ en http://localhost:4173
```

`narrate` usa Edge TTS (voz por defecto en español: `es-CO-GonzaloNeural`) y deja en `out/<libro>/audio/` un MP3 por capítulo, su `alignment.json` (inicio y fin de cada oración), un `playlist.m3u` para cualquier reproductor y un `manifest.json`. Es reanudable: lo ya generado se salta. Los números de `--chapters` son los de la columna `#` de `inspect`.

`preview` genera `out/<libro>/preview.html`: el libro como lo verá el lector (índice, capítulos, notas), un **modo revisión** que marca qué se narra y qué se omite (clic en una oración para ver exactamente qué dirá la voz) y un **reporte** con la clasificación de secciones, las reglas aplicadas y el costo estimado del audio. Si el libro ya tiene audio, aparece un **reproductor** que resalta la oración que suena y permite "escuchar desde aquí" haciendo clic en el texto.
