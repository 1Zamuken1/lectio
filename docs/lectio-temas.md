# Lectio — Temas de pixel art

*Especificación de diseño a partir de cuatro rondas de preguntas (25-09-2026). Desarrolla la idea A de `lectio-documentacion.md` §12.1.*

---

## 1. Visión

Lectio con **alma de juego de 16 bits**: la bienvenida es una pantalla de título, la biblioteca es un escenario y cada mundo tiene un compañero, animaciones, sonido y música propios. La excepción es **la lectura**: el texto del libro, su tamaño, su interlineado y su contraste se tocan lo mínimo posible.

Hay cuatro temas, cada uno con **día y noche**:

| Tema | Mundo | Compañero |
|---|---|---|
| **Scriptorium** | Monasterio de copistas: pergamino, tinta, iniciales iluminadas en oro y rojo, atril. Día: luz de ventanal. Noche: velas. | Búho escriba |
| **Bosque élfico** | Luminoso y noble, estilo Lothlórien: árboles plateados, oro y verde claro, luz filtrada. Noche: plata, linternas y luciérnagas. | Espíritu de luz |
| **Solarpunk** | Tecnología en armonía con la naturaleza, optimista y limpia (nada de distopía). Paleta de **cielo y sol**: celeste, blanco y amarillo solar, con el verde solo en las plantas. Noche: luces cálidas de la ciudad. | Dron jardinero |
| **Clásico** | El tema editorial actual (crema y azul tinta, `lectio-frontend.md` §2.2): sobrio, sin ambientación, de máxima accesibilidad. | — |

El bosque se queda con el verde, el oro y la plata; el solarpunk con el cielo y el sol. Así se distinguen al primer vistazo.

## 2. Decisiones

| Aspecto | Decisión |
|---|---|
| Estilo | **16-bit** (referentes: Chrono Trigger, Zelda: A Link to the Past, Stardew Valley). Marcos biselados, sombreado de 2 o 3 tonos, íconos de 16×16. |
| Intensidad | **Mezcla entre HUD de juego y mundo vivo**: interfaz de juego (menús de RPG, cuadros de diálogo) con escenas y animación ambiental, sin llegar a un juego pesado. |
| Pantallas con tratamiento completo | **Bienvenida como pantalla de título** (escena del tema, logo, "Pulsa para comenzar") y **biblioteca como escenario** (libros como lomos pixel en una estantería del tema). El reproductor y la lectura quedan sobrios, con el estilo del tema pero sin escena. Sin logros ni gamificación. |
| Zona de lectura | **Página temática sutil**: el texto sigue en Literata, con el mismo tamaño e interlineado, sobre una "página" con el color y un borde del tema (pergamino, hoja, panel). Textura casi imperceptible y contraste AAA garantizado. |
| Tipografía de la interfaz | **Fuente pixel en títulos**, menús y botones grandes (candidatas: Pixelify Sans, Silkscreen); **Atkinson Hyperlegible** en textos chicos y datos. |
| Vida | **Animaciones ambientales** (velas, luciérnagas, hojas, reflejos de sol), **efectos de sonido** de interfaz y **música ambiente** por tema. |
| Audio | **Generado por código** con Web Audio: efectos y música chiptune sintetizados en el navegador, sin archivos ni licencias de terceros. La música viene apagada por defecto y se silencia sola al reproducir el libro; los efectos nunca suenan encima de la narración. |
| Día y noche | **Según el sistema + interruptor**. La escena cambia (sol o luna, velas, linternas, luces de la ciudad). |
| Tema inicial | **Se elige en la bienvenida**, como elegir partida: la pantalla de título muestra los mundos. |
| Orden de trabajo | **Un tema completo primero** (día y noche, bienvenida, biblioteca, compañero y sonido) sobre el preview; con lo aprendido, los otros dos. |

## 3. Reglas que no se rompen

1. **Legibilidad de la lectura:** Literata o Atkinson en el cuerpo del libro, con el tamaño y el interlineado elegidos por el usuario; contraste AAA en el texto y AA en la interfaz, verificado por tema y por modo.
2. **Movimiento:** `prefers-reduced-motion` detiene toda animación ambiental y de transición.
3. **Sonido:** música apagada por defecto; nada suena encima de la narración; todo tiene su control de volumen y silencio.
4. **Rendimiento:** el arte se dibuja como SVG o CSS con píxeles cuadrados (`image-rendering: pixelated`), sin imágenes pesadas; las animaciones se pausan cuando la pestaña está oculta.
5. **Accesibilidad de los personajes:** el compañero es decoración (`aria-hidden`), se puede ocultar y nunca transmite información que no esté también en texto.

## 4. Arquitectura prevista

- Cada tema es un **módulo**: tokens de color, tipografía y espaciado para día y noche, sus piezas de arte (escena, marcos, íconos, compañero), su paleta de sonidos y su música.
- Un **registro de temas** activa uno con `data-world` y `data-mode` (día o noche) en la raíz, sin recargar.
- El tema **Clásico** es el que ya existe: el sistema de temas se construye alrededor de él sin romperlo.
- La elección se guarda por usuario (hoy en `localStorage`; en la app, en sus preferencias).

## 5. Pendiente de decidir

- ~~Qué tema se construye primero~~: el Scriptorium (ver §6).
- Nombres y personalidad de los compañeros (el del Scriptorium: Sabio, el búho).
- Motivos musicales de cada tema (instrumentación chiptune: laúd y órgano simulados para el scriptorium, arpa y flauta para el bosque, sintetizadores luminosos para el solarpunk).

## 6. Avance

- **Scriptorium (primer tema), en el preview de la CLI:** tokens de día y noche, marcos de madera, página de pergamino con esquineros e inicial iluminada, escena pixel (muros, estanterías, ventanal con sol o luna, vela, polvo en el haz de luz), el búho Sabio como compañero, efectos y música chiptune sintetizados con Web Audio (música apagada por defecto, se aparta cuando suena la narración).
- **Portada y biblioteca:** `lectio library` genera `out/index.html` con la pantalla de título (elección de mundo) y la estantería de lomos pixel; cada preview deja su `book.json`.
- **Interfaz de manuscrito iluminado (Scriptorium):** íconos de 16×16 en tinta, bermellón y oro (`icons.js`, cuatro tintas como variables de CSS), marco de cuero granate con filetes de oro, botones como placas de pergamino con borde dorado y ▶ como medallón de oro. En el Clásico, íconos de línea.
- **Escena:** ventanal con rosetón y paisaje (colinas, campos, pueblo con iglesia; de día nubes y pájaros, de noche luna, estrellas y ventanas encendidas); la luz sale del astro (sol a la derecha → haz hacia la izquierda; luna a la izquierda → haz tenue hacia la derecha). Estanterías talladas con libros detallados y objetos de monasterio.
- **Taller de copistas (espera):** mientras se genera la voz que pidió el usuario, un maestro y nueve aprendices aparecen sobre el reproductor y escriben un pergamino gigante con el progreso real; los aprendices visten el color de la voz (Gonzalo azul, Jorge verde, Salomé rojo, Salomé grave ciruela). Al terminar, el pergamino se enrolla, un aprendiz lo lleva por la puerta, suena una campanita y todos celebran. No bloquea clics. Cada mundo tendrá su propio taller: solo cambia el diseño y el trabajo. Sprites en `apps/cli/.scratch/workshop-sprites.mjs`.
- **La cuadrilla que trae un libro (app):** al subir un EPUB, el maestro y dos aprendices (los mismos sprites del taller) traen un libro gigante en alto por la tabla de la repisa, desde la punta que les deja más camino; uno tropieza. Si el worker tarda, esperan junto al hueco; al dejarlo, aparece el lomo y suena la campanita. `Pixel.bookCrew()` y `apps/web/src/library/BookCrew.tsx`.
- **El libro que arde (app):** un libro que no se pudo preparar arde con llamas de tres fotogramas (`Pixel.flames()`), queda en cenizas y renace con chispas como tarjeta de pergamino chamuscado. Solo la primera vez. En Clásico se desvanece. `apps/web/src/library/FailedBook.tsx`.
- Código: `apps/cli/assets/theme/` (theme.js, icons.js, pixel.js, sound.js, scriptorium.css) y `apps/cli/assets/library/`.
- Pendiente: Bosque élfico y Solarpunk (con sus talleres); más efectos de sonido en los botones; afinar la música tras escucharla.
- **En la app (`apps/web`, fases 6 y 7):** el Scriptorium quedó completo también en la app: las dos salas (biblioteca del monasterio y tu estudio) con su puerta, el atril, el lector y el reproductor, el taller, la cuadrilla, el libro que arde, y las descargas (aprendices que llevan los capítulos a un arcón, panel "Descargas" con forma de arcón y vela). El código de la app vive en `apps/web/src/theme/` y `apps/web/src/styles/`; la copia de la CLI (`apps/cli/assets/theme/`) quedó en lo que tenía al portarse.

## 7. Bosque élfico y Solarpunk: adaptar desde el Scriptorium

_Lo siguiente (decidido el 01-10-2026). El despliegue y Kokoro quedan para más adelante._

**El principio** (corregido el 01-10-2026): el Scriptorium está **completo** y no se toca. Bosque élfico y Solarpunk son **mundos propios**: cada uno tiene su composición, su HUD, sus lugares y su arte, y no reutiliza la estructura visual del Scriptorium (marcos, esquineros, la sala con estanterías a los lados y la ventana al centro). Lo que comparten es **la mecánica**: las mismas piezas (portada, dos salas y el paso entre ellas, compañero, taller, cuadrilla, libro fallido, descargas en escena, panel y sonidos), lo que cada una muestra (el avance real, los mismos estados y tiempos) y el mismo comportamiento con movimiento reducido y en el celular. La primera versión del Bosque (entregas 1 y 2, `2203f79` y `850b576`) era un Scriptorium con otra paleta y se rehace (§7.6).

Antes de dibujar, **preguntas de diseño** (como en cada etapa visual): ver la lista al final de esta sección.

### 7.1 Inventario: lo que hay que adaptar

Las equivalencias de las columnas de Bosque y Solarpunk son **propuestas para conversar**, no decisiones.

| Pieza | Scriptorium (dónde está) | Bosque élfico (propuesta) | Solarpunk (propuesta) |
|---|---|---|---|
| Paleta de pixel art (~130 tokens `--px-*`) | `styles/scriptorium.css`, "Paleta de pixel art" | Verdes claros, oro, plata, corteza clara; noche plata y azul | Celeste, blanco, amarillo solar; verde solo en plantas; noche luces cálidas |
| Tokens de la interfaz, día y noche (contrastes AAA verificados) | `scriptorium.css`, "Tokens de la interfaz" | Hoja clara / noche plateada | Panel blanco / noche cálida |
| HUD: marcos de cuero con filete de oro, esquineros, pestañas de cinta, botones como placas de pergamino, botón activo bermellón | `scriptorium.css`, "Encuadernación (HUD)" y "Encuadernación de paneles" | Madera plateada tallada, hojas en los esquineros | Paneles con bisel limpio, detalles de cobre o solar |
| Barra de progreso con pluma que escribe | `scriptorium.css` ("Progreso") y `Pixel.quill()` | Una enredadera que crece / una hoja que avanza | Un rayo de sol o un panel que se carga |
| Barras de desplazamiento (madera y latón) | `scriptorium.css` | Rama y gema | Riel y perilla de cristal |
| Página de lectura: pergamino con esquineros, inicial iluminada, oración que suena (oro pálido / ámbar) | `scriptorium.css`, "Página de lectura" | Hoja clara con borde de hojas; inicial con enredadera | Panel claro; inicial con motivo solar |
| Íconos de 16×16 en cuatro tintas (22: play, pause, prev, next, rewind, forward, sun, moon, settings, review, menu, home, door, voice, volume, volume-off, install, key, download, downloaded, chest, close) | `theme/icons.js` (`ILLUMINATED`; los mundos sin set usan los de línea) | Un set propio con la misma cuadrícula y las mismas tintas como variables | Ídem |
| Pantalla de título: escena con muros, ventanal con paisaje, sol o luna, vela, polvo en el haz, nubes, bandada; logo y "Pulsa para comenzar" | `Pixel.scriptoriumScene()`, `screens/TitleScreen.tsx` | Claro del bosque con árboles plateados, luz filtrada; noche linternas y luciérnagas | Ciudad jardín con paneles y torres verdes; noche ventanas cálidas |
| Sala pública: la gran biblioteca del monasterio (nave, tres vitrales, estanterías hasta el techo, escalera, atril, candelabros de noche) | `Pixel.monasteryScene()`, `library/LibraryRoom.tsx` (`ROOMS`) | Biblioteca dentro de un gran árbol / salón élfico | Biblioteca jardín bajo una cúpula de cristal |
| Sala propia: tu estudio (ventana, escritorio, sillón con mesita y vela, alfombra, tapiz, arcón con globo, puerta) | `Pixel.studyScene()` | Refugio en el árbol | Departamento luminoso con plantas |
| Puerta entre salas (se abre con luz cálida, fundido a negro, crujido) | `door()` en `pixel.js`, `library/room-door.tsx`, sonido `door` | Arco de ramas / velo de hojas | Puerta corredera, luz de sol |
| Estantería y lomos de libros (con paginación de estantes) | `bookshelf()`, `SPINES`, `library/shelves.ts` | Repisas de rama | Repisas modulares |
| Atril bajo la ficha (libro abierto) | `Pixel.lecternStand()`, `library/Lectern.tsx` | Atril de raíz o tocón | Atril de metal claro |
| Compañero: Sabio, el búho (globos, saltitos, lee mientras suena el libro) | `owl()`, `Pixel.owlBadge()`, `scriptorium.css` "Escena y compañero" | Espíritu de luz | Dron jardinero |
| Taller de copistas (espera de la voz): maestro y 9 aprendices escriben un pergamino gigante con el avance real; hábito por voz; al terminar lo enrollan, sale por la puerta, campana | `Pixel.workshop(voice)`, `player/Workshop.tsx`, `scriptorium.css` "Taller de copistas", sonido `bell` | Elfos tejiendo un tapiz o un canto de luz | Robots y jardineros armando un módulo |
| Cuadrilla que trae un libro subido (dos aprendices con el libro en alto, uno tropieza) | `Pixel.bookCrew()`, `library/BookCrew.tsx` | Elfos lo traen flotando / sobre una hoja | Drones lo traen |
| Libro que no se pudo preparar: arde, cenizas, renace con chispas | `Pixel.flames()`, `library/FailedBook.tsx`, sonidos `burn` y `reborn` | Se marchita y rebrota | Se apaga en cortocircuito y se reinicia |
| Descargas en escena: un aprendiz por capítulo lleva su pergamino a un arcón al pie del atril (o en una franja en el celular); el arcón se cierra con un "clonc" | `Pixel.scrollCarrier()`, `Pixel.downloadChest()`, `library/DownloadCrew.tsx`, sonido `chest` | Lo guardan en un cofre de raíz / una semilla | Lo suben a un contenedor o batería |
| Panel "Descargas": arcón abierto con vela que se consume | `library/DownloadsPanel.tsx`, `styles/library.css` (bloque Scriptorium) | Cofre de raíz, vela → luciérnaga o savia | Contenedor, vela → batería |
| Sonidos (select, toggle, open, confirm, page, start, hoot, bell, door, burn, reborn, chest) y música chiptune | `theme/sound.js` | Arpa y flauta | Sintetizadores luminosos |

Clásico no cambia: es el tema sin ambientación y la referencia de accesibilidad.

### 7.2 Dónde el código supone el Scriptorium

Al agregar un mundo, estos puntos deciden si hay arte, escena o animación:

- `theme/theme.ts`: `WORLDS` (los dos nuevos tienen `ready: false`).
- `apps/web/index.html`: el script que aplica el tema antes de pintar acepta solo `scriptorium` y `clasico`; hay que sumar los nuevos (con la misma regla que `theme.ts`).
- Comprobaciones `world === 'scriptorium'`: `player/Workshop.tsx` (el taller), `library/DownloadCrew.tsx` (el arcón), `screens/Study.tsx` (`animated()`: cuadrilla y fuego) y `screens/TitleScreen.tsx` (la escena y el mundo de la primera visita). Conviene reemplazarlas por una sola pregunta al registro de temas ("¿este mundo tiene escenas?") en vez de sumar más comparaciones.
- `theme/icons.js`: `ILLUMINATED` es el set del Scriptorium; los demás caen a los íconos de línea.
- `theme/pixel.js`: las escenas, los sprites y la paleta del taller (`CREW_PALETTE`) son del Scriptorium; el motor (`canvas`, `actor`, `random`) se reutiliza tal cual.
- CSS: unos 270 selectores `[data-world='scriptorium']` (`scriptorium.css` 133, `library.css` 110, `app.css` 24, `reader.css` 2). Cada mundo nuevo, su hoja (`bosque.css`, `solarpunk.css`) con las mismas secciones que `scriptorium.css`.
- Los hábitos por voz del taller (`.px-workshop[data-voice=…]` en `scriptorium.css`): cada mundo decide cómo se distinguen las cuatro voces.
- `components/ThemeTools.tsx`: el texto del interruptor del compañero ("El búho del scriptorium").
- El prerender (`apps/web/build/prerender.ts`) no depende del mundo: sus páginas usan las clases del lector.

### 7.3 Cómo se trabaja

- Un mundo completo primero (como se hizo con el Scriptorium), por entregas con capturas y una pausa en cada una, y commit al cerrar el mundo. Orden sugerido: (1) paleta, HUD, página e íconos; (2) pantalla de título y las dos salas con su puerta; (3) compañero; (4) taller, cuadrilla, libro fallido y descargas en escena; (5) sonidos y música. Luego el otro mundo, con lo aprendido.
- En cada pieza, partir del código del Scriptorium (su función de `pixel.js`, su sección de CSS, su componente) y cambiar arte y paleta sin tocar la mecánica.
- Verificar contrastes (AAA en el texto, AA en la interfaz) en día y noche, el movimiento reducido y el celular, como en el Scriptorium.

### 7.4 Preguntas de diseño para empezar

- ¿Qué mundo va primero?
- Compañeros: nombre y personalidad del espíritu de luz y del dron jardinero.
- Equivalencias de cada sala (sala pública y sala propia) y de la puerta entre ellas.
- Quiénes trabajan en el taller de cada mundo, cuál es "el trabajo" que llena el progreso y cómo se distinguen las cuatro voces.
- Cómo se ve el arcón de descargas y la vela del panel en cada mundo.
- Día y noche de cada escena (qué cambia de noche).
- Sonidos y motivo musical de cada mundo.
- ¿La copia de la CLI (`apps/cli/assets/theme/`) también recibe los mundos nuevos, o solo la app?

### 7.5 Decisiones (01-10-2026)

**Generales**

- **Primero el Bosque élfico**; después Solarpunk, con lo aprendido.
- **Solo la app** (`apps/web`) recibe los mundos nuevos; la CLI (`apps/cli/assets/theme/`) se queda con el Scriptorium y el Clásico por ahora.
- Compañero del Solarpunk: **el dron jardinero** (nombre y personalidad, cuando toque ese mundo).

**Bosque élfico** (rediseño del 01-10-2026; reemplaza la tabla anterior)

| Pieza | Decisión |
|---|---|
| Estilo | **Como Stardew Valley / Terraria** (corregido tras la maqueta): pixel nítido a 320×180, **colores sólidos** (sin bruma ni tramas), siluetas claras con **contorno de color** (más oscuro que el objeto, nunca negro), objetos grandes que se lean. |
| Referencia | El bosque es el protagonista; **Demacia solo en detalles** (algo de oro con alas: el logo, el medallón del reproductor), sin arquitectura de piedra. |
| Paleta de día | **Atardecer dorado**: luz ámbar que entra entre las hojas, verdes oliva y turquesa en las sombras. |
| Noche | **Luna plateada**: azul noche, la luna grande, estrellas y luciérnagas; las linternas del árbol en ámbar. |
| Tipografía | **Handjet** (fuente pixel estrecha y fina; elegida en la maqueta); el logo, con letras dibujadas a mano. Lectura en Literata e interfaz en Atkinson, como siempre. |
| HUD | **Paneles flotantes opacos y sólidos** (corregido tras la maqueta: el cristal lavaba la escena): crema con borde de oro de día, azul noche de noche; esquinas en escalón de píxeles; nada pegado a los bordes. El reproductor, un panel flotante abajo al centro, con el medallón de oro con alas. |
| Íconos | 16×16, **pixel suave sin contorno negro** (luz y sombra), en ámbar, verde y crema. |
| Portada | **El lago y su reflejo**: el gran árbol domina la mitad derecha, a la orilla de un lago que lo refleja (el reflejo se mueve en pasos y titila el camino de luz); en la cima de la copa asoma la biblioteca (baranda, arco con libros y linternas); al frente, nenúfares y juncos. De noche, la luna, luciérnagas y las linternas encendidas. |
| Sala pública | **Una biblioteca construida sobre la copa** (boceto del usuario y ajustes, 01-10-2026): el piso es una **plataforma de tablas de madera clara** en perspectiva (fugan al fondo), con baranda; la copa asoma alrededor de la plataforma y las ramas gruesas (madera clara sin corteza, Demacia) siguen creciendo detrás; hojas en las esquinas de abajo. Muebles: alfombra, rincón de lectura, farol y macetas con flores azules. |
| Libros | **Lomos de pie** en la estantería del centro (los libros reales), de pie sobre la plataforma y abrazada por un arco de dos ramas vivas con hojas y linternas; a los lados, dos estanterías con libros dibujados. Las hojas: grumos de borde dentado con hojitas dibujadas. |
| Sala propia | **Un hueco arriba en el mismo árbol**: la abertura es un gran arco de corteza viva con hiedra, abierto a una rama; por él se ven el cielo, las copas y, abajo, la plataforma de la biblioteca. Tus libros (los reales) de pie en el alféizar. Adentro: nido de cojines con manta, mesita con linterna y maceta, alfombra, linternas colgadas y hongos que brillan de noche. |
| Paso entre salas | **Subir o bajar por el árbol**: la vista se desliza en pasos por un tramo de tronco (corteza, ramas, hiedra, la copa al pie) hasta la otra sala, en lo mismo que dura el fundido; con movimiento reducido, directo. |
| Página de lectura | **Una hoja sólida** como los demás paneles (crema con borde de oro y esquinas en escalón) sobre la biblioteca **nítida y atenuada** (sin desenfoque: no es pixel). |
| Nombres de las salas | Solo cambia el título de la sala (lo lee el lector de pantalla); los botones siguen diciendo "Biblioteca" y "Estudio". |
| Compañero | **Lumen**, una bolita de luz con carita y alitas de hoja (curioso y juguetón): flota junto a la estantería y habla en su globo con **su propia voz** (los avisos reescritos en `library/companion-voice.ts`; los títulos se conservan). Cuando pasa algo da una **voltereta con chispas**; ante un error se encoge y su luz baja. En el índice del lector brilla más mientras suena; al empezar cada párrafo **se asoma** un momento al margen de la página; en la portada revolotea junto al título. Respeta el interruptor del compañero y el movimiento reducido. |
| Se mantiene | **Lumen**, el espíritu de luz (curioso y juguetón); el **taller del tapiz** (maestra y 9 aprendices, capa por voz, campanilla de cristal); **cofre de raíz** y **frasco de luciérnagas** para las descargas; el libro que **se marchita y rebrota**; **arpa y flauta**. Su forma concreta se vuelve a preguntar en cada entrega. |
| Cómo se trabaja | Primero una **maqueta estática** (la portada, el gran árbol con su estantería, los paneles y la página, de día y de noche); se ajusta ahí y después se pasa a la app. |

### 7.6 Avance del Bosque élfico

- **En la app (01-10-2026)**: el rediseño, pasado de la maqueta (ya borrada) a la app con más elementos donde había huecos. Las escenas son de lienzo (`theme/bosque-scenes.js`, 320 × 180, se dibujan una vez por modo y lo que se mueve se repinta en pasos: el agua del lago, las luciérnagas, las mariposas) y se muestran con `components/RasterArt.tsx`; `world-art.ts` las da con `rasterScene()`. Cada escena dice en sus coordenadas dónde va la estantería real y la puerta: `LibraryRoom` las pasa a píxeles (`--shelf-*`, `--door-*`) y escala los lomos (`--spine-k`) para que midan lo que los dibujados. La puerta entre salas es un **ascensor de lianas** (se toca en la escena; el teclado usa la barra) y el paso es la vista que sube o baja por el tronco (`RoomPassage` en `room-door.tsx`). Detrás del lector, la sala de la que viene el libro, atenuada. Paneles sólidos flotantes, medallón con alas, hilo de luz con luciérnaga, 22 íconos suaves (`icons-bosque.js`) y Handjet. Agregado sobre la maqueta: guirnaldas de luces entre las ramas, el ascensor en las dos salas, un muelle con farol en el lago, repisas con frascos y hierbas, un cesto de rollos, mariposas de día. Falta: Lumen, el taller, la cuadrilla, el libro que se marchita, las descargas en escena y los sonidos.
- **Se rehace (01-10-2026)**: las entregas 1 y 2 de abajo copiaban la estructura del Scriptorium. De ellas se queda la infraestructura (el registro de mundos, `world-art.ts`, `data-scenes`, el motor de pixel art compartido); el arte, el CSS y la disposición del Bosque se rehacen según la tabla nueva, a partir de una maqueta.

- **Base (01-10-2026)**: el registro de mundos (`theme/worlds.ts`: `ready`, `scenes`, `companion`) reemplaza las comprobaciones `world === 'scriptorium'` (`hasScenes()`); en `pnpm dev` se eligen también los mundos a medio hacer ("En desarrollo") y el build los deja fuera hasta que estén `ready` (el script de `index.html` recibe la lista desde `vite.config.ts`). Las piezas de pixel art que comparte todo HUD (esquinero de la página y perilla del progreso) se piden por mundo en `theme/world-art.ts`.
- **Entrega 1 (01-10-2026)**: paleta, tokens día y noche, talla del HUD (madera plateada, filetes de plata y oro, emblema de alas, botones como hojas lisas, medallón de oro), enredadera del progreso con su brote, barras de desplazamiento, índice con marcador de hoja, paneles, página (filetes de oro y hoja, ramitas en las esquinas, inicial esmeralda con zarcillos) y los 22 íconos. Archivos: `styles/bosque.css`, `theme/icons-bosque.js`, `theme/bosque.js`. Sin escenas todavía: la portada y las salas se ven como en el Clásico con la paleta del Bosque.
- **Entrega 2 (01-10-2026)**: la portada (interior del salón), el salón élfico (tres ventanas ojivales con vidrios de hoja, oro y plata, columnas como troncos, la galería al jardín, faroles y el atril de piedra), el refugio (tablones plateados, la rama del techo, la ventana ovalada, el escritorio de rama, el sillón de musgo, el tocón con su linterna, el tapiz, la alfombra tejida y el cofre de raíz), el arco de ramas (las mismas clases que la puerta del Scriptorium) y el pie del atril (un tocón). De noche: linternas, luciérnagas, la luna, las torres encendidas y los hongos que brillan. El registro separa `scenes` (portada, salas, puerta) de `crew` (taller, cuadrilla, fuego, arcón) y la raíz lleva `data-scenes`: la disposición de las salas (dónde va la estantería, el fundido, el encuadre del celular) vale para todo mundo con escenas; el arte, en la hoja de cada mundo. La ligadura "fi" de Pixelify Sans venía rota: solo la prosa usa ligaduras.
- **Lumen (01-10-2026)**: el compañero del Bosque en las salas, en el índice, asomado a la página y en la portada (`Bosque.lumen()` en `bosque.js`; las piezas `companion` y `companionFree` de `world-art.ts`). Las salas pasan cada aviso por `companionLine(mundo, texto)`, que lo reescribe con la voz del compañero y dice si es un error (para encogerlo); el Scriptorium y el Clásico dicen el texto tal cual. Los títulos de las salas del Bosque son "La biblioteca del gran árbol" y "Tu hueco en el árbol".
