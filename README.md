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

`preview` genera `out/<libro>/preview.html`: el libro como lo verá el lector (índice, capítulos, notas), un **modo revisión** que marca qué se narra y qué se omite (clic en una oración para ver exactamente qué dirá la voz) y un **reporte** con la clasificación de secciones, las reglas aplicadas y el costo estimado del audio.
