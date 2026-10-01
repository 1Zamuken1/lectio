# Prueba en un Android real (fase 7, etapa 5)

Lo que Playwright no puede comprobar: instalar la PWA, cortar la red de verdad, la pantalla bloqueada y los controles del sistema. Se hace a mano, en un celular Android con Chrome, contra el build local.

## Preparar

1. En el computador: `pnpm db:up`, `pnpm dev` (la API) y, en otra terminal, `pnpm --filter @lectio/web preview:pwa` (la PWA en `:4174`).
2. En el celular: **Ajustes → Acerca del teléfono →** tocar 7 veces "Número de compilación" (opciones de desarrollador) y activar **Depuración por USB**.
3. Conectar el celular por USB. En el Chrome del computador, abrir `chrome://inspect/#devices`, aceptar el permiso en el celular y, en **Port forwarding**, agregar `4174 → localhost:4174` (y `3000 → localhost:3000` no hace falta: la API va por el proxy de `:4174`).
4. En el Chrome del celular, abrir `http://localhost:4174`. Para el Service Worker es `localhost`, así que funciona igual que en el computador (no hace falta HTTPS).

Para ver la consola del celular: `chrome://inspect` → **inspect** bajo la pestaña.

## Qué probar

Anotar en cada fila ✓, ✗ (con lo que pasó) o "no aplica".

| # | Prueba | Cómo | Esperado | Resultado |
|---|---|---|---|---|
| 1 | Instalar | En la biblioteca, botón **Instalar** (o menú ⋮ → Instalar app) | Se instala con el ícono de la mesa de encantamientos; abre sin barra del navegador | |
| 2 | Abrir sin red | Con la app instalada y abierta una vez, **modo avión**, cerrar y volver a abrir | Abre; la biblioteca muestra la última visita y "Sin conexión" | |
| 3 | Descargar | Con red: atril de un libro → ícono de un capítulo y "Descargar los próximos 3" | Anillo que se llena, aprendices hasta el arcón en la franja, sello al terminar | |
| 4 | Leer sin red | Modo avión → abrir el capítulo descargado | Se lee completo, con sus imágenes | |
| 5 | Capítulo no descargado | Sin red, ir a uno no descargado | "Este capítulo no está descargado…" y el botón al más cercano | |
| 6 | Escuchar sin red | Sin red, ▶ en un capítulo descargado con audio | Suena; se puede adelantar y retroceder (la barra responde) | |
| 7 | Pantalla bloqueada | Mientras suena, bloquear la pantalla 2 minutos | Sigue sonando; al desbloquear, la oración resaltada es la que suena | |
| 8 | Controles del sistema | Con la pantalla bloqueada: notificación de medios / auriculares | Título y libro en la notificación; pausa, siguiente y anterior funcionan | |
| 9 | Avance automático sin red | Sin red, dejar terminar un capítulo descargado | Pasa al siguiente descargado; si no hay, se detiene con el búho | |
| 10 | Progreso que vuelve | Con sesión: sin red, leer en otro capítulo; volver a la red | En el computador, el libro abre donde quedaste en el celular | |
| 11 | Panel Descargas | Barra → Descargas | Hoja inferior con el espacio, los libros y quitar con "Deshacer" | |
| 12 | Espacio persistente | Tras la primera descarga, en la consola: `await navigator.storage.persisted()` | `true` (con la app instalada, Chrome suele concederlo) | |
| 13 | Versión nueva | Cambiar algo, `preview:pwa` de nuevo, volver a la app | Aviso "Nueva versión" con "Actualizar"; no recarga sola | |

## Si algo falla

- **No se instala**: en `chrome://inspect` → inspect → Application → Manifest, ver los errores del manifiesto.
- **Sin red no abre**: Application → Service Workers (¿está activo?) y Cache Storage (¿están `workbox-precache` y `lectio-downloads`?).
- **El audio no suena sin red**: Network, filtrar por `media`: las respuestas deben venir del Service Worker con `206`.
