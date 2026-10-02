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

_El Bosque élfico quedó completo el 01-10-2026; lo siguiente es Solarpunk (§7.7). El despliegue y Kokoro quedan para más adelante._

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

_Resuelto con el Bosque (01-10-2026): todo esto pasó al registro de mundos y a `world-art.ts`; para un mundo nuevo, ver la tabla de §7.7. Se deja como historia._

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
| Taller | **El tapiz del gran árbol**: se teje fila a fila, de abajo hacia arriba (el lago, el tronco, la copa con la biblioteca), con el avance real. La maestra élfica señala; dos tejen en el telar, uno hila en la rueca, uno devana ovillos, uno remueve el caldero de tinte (del color de la voz), dos traen ovillos (uno se enreda y cae) y uno duerme en una hamaca. Al terminar lo enrollan, dos lo llevan a la canasta del ascensor de lianas, la canasta sube, suena la campanilla de cristal y Lumen da una voltereta. Capas por voz, colores propios: Gonzalo turquesa, Jorge musgo, Salomé ámbar, Salomé grave lavanda. |
| Elfos | **Al estilo de El Señor de los Anillos**: altos y delgados, sin capucha, pelo largo y lacio que cae por los hombros (dorado, plateado o castaño oscuro, repartido en la cuadrilla), orejas puntiagudas, diadema de oro, broche de hoja y túnica larga del color de la voz; la maestra, de pelo plateado y túnica clara. |
| Cuadrilla | **Sube en el ascensor de lianas**: la canasta aparece en la punta derecha de la repisa, dos elfos bajan con el libro gigante en alto (tapas de hoja) y lo llevan a su hueco, uno tropieza; Lumen va adelante. Al irse, la canasta baja. |
| Libro fallido | **Se marchita y rebrota**: caen hojas secas mientras el lomo se apaga a marrón, queda un montón de hojas y rebrota con destellos verdes como un panel con el motivo. Mismos tiempos que el que arde. |
| Descargas | **Cofre de raíz**: al bajar un libro, un elfo por capítulo (capa de la voz) lleva un rollo de tela al cofre de raíz al pie del atril; el cofre se abre, recibe los rollos y se cierra con un brote. En el panel "Descargas", el medidor es un **frasco de luciérnagas** con su corcho: las luciérnagas se apagan a medida que se llena el espacio. El panel dice "El cofre está vacío". |
| Sonido | **Arpa, flauta y cristal**, sintetizados como en el Scriptorium (`theme/sound-bosque.js`). Música: arpa en fa lidio con frases cortas de flauta a ratos; de noche más lenta y grave, con grillos; de día, pajaritos sueltos. Lumen: una risita de cristal que sube (fin de capítulo) y dos notas que bajan cuando se encoge. Cada efecto con su materia: botones y páginas, pellizcos de arpa; ascensor, crujido de lianas y madera; marchitar, hojas secas que caen; rebrotar, arpa con destellos; cofre, "tok" de madera hueca; campanilla de cristal. |
| Se mantiene | **Lumen**, el espíritu de luz (curioso y juguetón); el **taller del tapiz** (maestra y 9 aprendices, capa por voz, campanilla de cristal); **cofre de raíz** y **frasco de luciérnagas** para las descargas; el libro que **se marchita y rebrota**; **arpa y flauta**. Su forma concreta se vuelve a preguntar en cada entrega. |
| Cómo se trabaja | Primero una **maqueta estática** (la portada, el gran árbol con su estantería, los paneles y la página, de día y de noche); se ajusta ahí y después se pasa a la app. |

### 7.6 Avance del Bosque élfico

- **En la app (01-10-2026)**: el rediseño, pasado de la maqueta (ya borrada) a la app con más elementos donde había huecos. Las escenas son de lienzo (`theme/bosque-scenes.js`, 320 × 180, se dibujan una vez por modo y lo que se mueve se repinta en pasos: el agua del lago, las luciérnagas, las mariposas) y se muestran con `components/RasterArt.tsx`; `world-art.ts` las da con `rasterScene()`. Cada escena dice en sus coordenadas dónde va la estantería real y la puerta: `LibraryRoom` las pasa a píxeles (`--shelf-*`, `--door-*`) y escala los lomos (`--spine-k`) para que midan lo que los dibujados. La puerta entre salas es un **ascensor de lianas** (se toca en la escena; el teclado usa la barra) y el paso es la vista que sube o baja por el tronco (`RoomPassage` en `room-door.tsx`). Detrás del lector, la sala de la que viene el libro, atenuada. Paneles sólidos flotantes, medallón con alas, hilo de luz con luciérnaga, 22 íconos suaves (`icons-bosque.js`) y Handjet. Agregado sobre la maqueta: guirnaldas de luces entre las ramas, el ascensor en las dos salas, un muelle con farol en el lago, repisas con frascos y hierbas, un cesto de rollos, mariposas de día. Falta: Lumen, el taller, la cuadrilla, el libro que se marchita, las descargas en escena y los sonidos.
- **Se rehace (01-10-2026)**: las entregas 1 y 2 de abajo copiaban la estructura del Scriptorium. De ellas se queda la infraestructura (el registro de mundos, `world-art.ts`, `data-scenes`, el motor de pixel art compartido); el arte, el CSS y la disposición del Bosque se rehacen según la tabla nueva, a partir de una maqueta.

- **Base (01-10-2026)**: el registro de mundos (`theme/worlds.ts`: `ready`, `scenes`, `companion`) reemplaza las comprobaciones `world === 'scriptorium'` (`hasScenes()`); en `pnpm dev` se eligen también los mundos a medio hacer ("En desarrollo") y el build los deja fuera hasta que estén `ready` (el script de `index.html` recibe la lista desde `vite.config.ts`). Las piezas de pixel art que comparte todo HUD (esquinero de la página y perilla del progreso) se piden por mundo en `theme/world-art.ts`.
- **Entrega 1 (01-10-2026)**: paleta, tokens día y noche, talla del HUD (madera plateada, filetes de plata y oro, emblema de alas, botones como hojas lisas, medallón de oro), enredadera del progreso con su brote, barras de desplazamiento, índice con marcador de hoja, paneles, página (filetes de oro y hoja, ramitas en las esquinas, inicial esmeralda con zarcillos) y los 22 íconos. Archivos: `styles/bosque.css`, `theme/icons-bosque.js`, `theme/bosque.js`. Sin escenas todavía: la portada y las salas se ven como en el Clásico con la paleta del Bosque.
- **Entrega 2 (01-10-2026)**: la portada (interior del salón), el salón élfico (tres ventanas ojivales con vidrios de hoja, oro y plata, columnas como troncos, la galería al jardín, faroles y el atril de piedra), el refugio (tablones plateados, la rama del techo, la ventana ovalada, el escritorio de rama, el sillón de musgo, el tocón con su linterna, el tapiz, la alfombra tejida y el cofre de raíz), el arco de ramas (las mismas clases que la puerta del Scriptorium) y el pie del atril (un tocón). De noche: linternas, luciérnagas, la luna, las torres encendidas y los hongos que brillan. El registro separa `scenes` (portada, salas, puerta) de `crew` (taller, cuadrilla, fuego, arcón) y la raíz lleva `data-scenes`: la disposición de las salas (dónde va la estantería, el fundido, el encuadre del celular) vale para todo mundo con escenas; el arte, en la hoja de cada mundo. La ligadura "fi" de Pixelify Sans venía rota: solo la prosa usa ligaduras.
- **Lumen (01-10-2026)**: el compañero del Bosque en las salas, en el índice, asomado a la página y en la portada (`Bosque.lumen()` en `bosque.js`; las piezas `companion` y `companionFree` de `world-art.ts`). Las salas pasan cada aviso por `companionLine(mundo, texto)`, que lo reescribe con la voz del compañero y dice si es un error (para encogerlo); el Scriptorium y el Clásico dicen el texto tal cual. Los títulos de las salas del Bosque son "La biblioteca del gran árbol" y "Tu hueco en el árbol".
- **El taller del tapiz (01-10-2026)**: `Bosque.workshop(voz)` en `bosque.js`, con las mismas clases y tiempos que el taller del Scriptorium; `world-art.ts` lo da con `workshopArt()`. El registro de mundos separa la gente animada en piezas (`crew: ['workshop', 'bookCrew', 'downloads']`; `hasCrew(mundo, pieza)`): el Bosque tiene el taller; la cuadrilla, el libro que se marchita y el arcón, todavía no.
- **Cuadrilla, libro que se marchita y elfos nuevos (01-10-2026)**: `Bosque.bookCrew()`, `Bosque.crewLift()` y `Bosque.wither()` en `bosque.js`; `world-art.ts` los da con `crewArt()` y `flamesArt()`; `BookCrew.tsx` pone la canasta fija en la punta de la repisa y, con ascensor, la cuadrilla llega siempre por la derecha. Los elfos del taller pasan al estilo de El Señor de los Anillos (pelo por elfo con `--px-hair`).
- **Descargas (01-10-2026)**: `Bosque.clothCarrier(voz)` y `Bosque.rootChest()` en `bosque.js`; `world-art.ts` los da con `downloadArt()` y `DownloadCrew.tsx` los usa con las mismas clases que el arcón. Cada mundo dice cómo se llama su recipiente (`downloadsVessel` en `worlds.ts`: "El arcón", "El cofre"). El frasco de luciérnagas del panel es solo CSS en `bosque.css`.
- **Sonido (01-10-2026)**: `theme/sound-bosque.js` con los efectos (`SFX`) y la música (`startMusic`, `scheduleMusic`); `sound.js` los elige cuando el mundo es el Bosque y les pasa el contexto y los buses. Efecto nuevo `sad` (Lumen se encoge; el búho no tiene). Con esto el Bosque élfico tiene todas sus piezas; falta marcarlo `ready` tras una revisión completa.
- **Controles (01-10-2026)**: nada del sistema a la vista. Los botones de texto son tablillas de madera pálida con vetas y esquinas en escalón; el principal lleva una hojita y filete de oro, el que borra una hoja seca. Las casillas son capullos que se abren en flor; el volumen, una rama con una luciérnaga por perilla. Entrar: campos como hendiduras en la madera y una rama con hojas arriba; subir: el libro en blanco de corteza con un brote y, al arrastrar, un marco de ramas. La barra y el reproductor dibujan su panel en una capa de atrás (`::before`): el recorte en escalón en el propio elemento cortaba los menús de adentro (la rueda de ajustes no se veía).

- **Aprobado (02-10-2026)**: el usuario aprobó el Bosque y queda `ready: true` en `theme/worlds.ts`: el build ya lo deja elegir. Probado con una cuenta de prueba (borrada después): el libro en blanco, el velo de arrastre, una subida real con la cuadrilla y los menús del reproductor (velocidad, volumen y voz) sin recortes. Se corrigió de paso: las reglas del estudio del Scriptorium (`library.css`, repisa de pared de 48vw) también movían la estantería del Bosque y sacaban de pantalla el globo de Lumen; ahora no valen con `data-layout='scene'`. Y en pantallas angostas los menús del reproductor se salían por la izquierda (en todos los mundos): `Popover` en `player/PlayerBar.tsx` ahora los mantiene dentro.

### 7.7 Solarpunk: cómo empezar (lo aprendido con el Bosque)

Solarpunk es el último mundo. Es lo único que falta de los temas. Hoy está en el registro con `scenes: false` y `crew: []`, así que se ve como el Clásico. Se hace como el Bosque: **preguntas de diseño primero** (§7.4 y las de abajo), una **maqueta** del estilo que el usuario apruebe antes de pasarla a la app, y después pieza por pieza, con commit al cerrar cada una.

**Lo que ya está listo para un mundo nuevo (la mecánica no se toca):**

| Para | Dónde se enchufa | Cómo lo hizo el Bosque |
|---|---|---|
| Registro del mundo | `theme/worlds.ts`: `ready`, `scenes`, `crew` (`workshop`, `bookCrew`, `downloads`), `companion`, `companionCaption`, `downloadsVessel`, `rooms` | `scenes: true`, las tres piezas, "Lumen, el espíritu de luz", "El cofre" y títulos de sala propios |
| Escenas (portada, dos salas, el paso) | `theme/world-art.ts`: `rasterScene()` (lienzo) o `worldArt()` con `title`, `monastery`, `study` (SVG) | `theme/bosque-scenes.js`: `SCENES` con `title`, `monastery`, `study` y `trunk`. Cada sala dice en sus coordenadas (320 × 180) dónde van la estantería real (`shelf`) y la puerta (`door`), y `LibraryRoom` las ubica sola. El paso entre salas usa la escena `trunk` si existe (`RoomPassage`) |
| Piezas del HUD | `worldArt()` con `pageCorner`, `progressThumb`, `lecternStand`, `companion`, `companionFree` | `theme/bosque.js` (`Bosque.firefly`, `lecternStand`, `lumen`) |
| Íconos | `theme/icons.js`: `PIXEL_SETS` | `theme/icons-bosque.js` (`SYLVAN`, 22 íconos) |
| Taller | `workshopArt(mundo, voz)` en `world-art.ts`, con las mismas clases `.ws-*` y los mismos tiempos que el Scriptorium | `Bosque.workshop(voz)`: el tapiz, 200 × 40 |
| Cuadrilla y libro fallido | `crewArt(mundo)` (con `lift` opcional: un vehículo fijo en la punta de la repisa) y `flamesArt(mundo)` | `Bosque.bookCrew()`, `crewLift()`, `wither()` |
| Descargas en escena | `downloadArt(mundo)`: `carrier(voz)`, `carrierHeight` y `chest` (grupos `dl-walker`/`dl-cheer` y `dl-lid-closed`/`dl-lid-open`) | `Bosque.clothCarrier`, `Bosque.rootChest` |
| Voz del compañero | `library/companion-voice.ts`: `VOICES[mundo]` (reglas aviso → frase; los errores lo encogen) | `LUMEN` |
| Sonido | `theme/sound.js` elige por mundo; el mundo trae `SFX` (los nombres de `sound.d.ts`; `sad` es opcional), `startMusic` y `scheduleMusic(audio, noche)` | `theme/sound-bosque.js` |
| CSS | una hoja propia (`styles/solarpunk.css`, importada en `main.tsx`) con las mismas secciones que `bosque.css` | `styles/bosque.css`: tokens de día y noche, paneles, barra, reproductor, página, escenas, portada, entrar, compañero, taller, cuadrilla, descargas, botones y controles |

**Trampas que ya se pagaron (no repetirlas):**

- **El estilo se aprueba con una maqueta.** La primera versión del Bosque copiaba la estructura del Scriptorium con otra paleta y hubo que rehacerla. El usuario quiere un mundo **propio** (composición, lugares, HUD), no un reskin.
- El pixel art del Bosque es nítido, estilo Stardew/Terraria: 320 × 180, colores sólidos, contornos de color (nunca negros), objetos grandes y legibles, sin brumas ni tramas. Las hojas tienen que parecer hojas (no círculos) y la escala de cada objeto, coherente con la de los demás.
- Un `clip-path` en un elemento recorta **todo lo de adentro**. Los paneles con menús (la barra, el reproductor) dibujan su forma en un `::before` detrás; así se arregló la rueda de ajustes del Bosque.
- `:is(…)` pesa como su argumento más específico, así que una regla posterior más simple puede perder: en el Bosque, `.danger` necesitó `:root`.
- Ningún control del sistema a la vista: botones de texto, casillas, deslizadores, los campos de entrar y la subida llevan la forma del mundo (el usuario lo notó en el Bosque).
- Las escenas de lienzo se dibujan una vez por modo (caché) y lo que se mueve se repinta en pasos de 125 ms; con movimiento reducido o la pestaña oculta, quedan quietas. Cada cuadro tiene que costar poco: la maqueta del Bosque tardaba 180 ms hasta que se cacheó la base.
- El panel del navegador oculto no corre animaciones. Para revisarlas, `document.getAnimations().forEach(a => a.finish())` o pausarlas en un punto; el reproductor se simula con `window.lectio.player.store.setState`.
- Antes de cada commit, `pnpm check` desde la raíz, y confirmar que sale con código 0.

**Preguntas de diseño para el Solarpunk** (además de las de §7.4):

- Estilo: ¿el mismo pixel art de 320 × 180 del Bosque u otro (más limpio, isométrico, con más resolución)?
- Portada y salas: ¿una ciudad jardín con torres verdes, un invernadero bajo una cúpula, una azotea con paneles? ¿Qué es la sala propia, y cómo se pasa de una a otra (ascensor de cristal, tranvía, puente)?
- El dron jardinero: nombre, personalidad, cómo reacciona (alegría, error) y dónde aparece (sala, índice, página, portada).
- El taller: quiénes trabajan (robots, jardineros o ambos), cuál es el trabajo que llena el progreso y los colores por voz.
- La cuadrilla, el libro fallido (cortocircuito y reinicio), las descargas (contenedor o batería) y el medidor del panel.
- HUD: forma de los paneles, el botón de reproducir, la barra de progreso, los íconos y la fuente de los títulos.
- Sonido: sintetizadores luminosos; el motivo musical, el ambiente de día y de noche y el sonido del dron.

### 7.8 Decisiones del Solarpunk (02-10-2026)

| Pieza | Decisión |
|---|---|
| Estilo | **Igual que el Bosque**: pixel nítido a 320×180 estilo Stardew/Terraria, colores sólidos, contornos de color (nunca negros), objetos grandes y legibles. |
| Portada | **Un apartamento hiperfuturista** visto desde adentro; por el ventanal, rascacielos blancos hiperfuturistas y paisaje. Los detalles (autos voladores, drones, tranvía, etc.) los propone la maqueta. |
| Luz | **Día: mañana dorada** (sol bajo, amarillo cálido, sombras largas celestes). **Noche**: la ciudad encendida (ventanas de los edificios, las luces del propio apartamento y, si suman, vehículos voladores con sus luces). |
| Sala pública | **Una terraza abierta, sin techo** (corregido tras la maqueta: la pérgola tapaba la ciudad): balcón de vidrio con jardinera corrida y la ciudad en todo su esplendor (bahía, azoteas vecinas con paneles, dirigible, tren, autos voladores); huerto con girasoles, tumbona, farol solar y el pabellón con la puerta. |
| Sala propia | **El mismo apartamento de la portada, con otra vista**: ventana lateral, el panel de tus libros empotrado en la pared (parte de la casa, no un mueble agregado) entre dos macetas colgantes, la cómoda con un robot en su base de carga, la silla huevo y la puerta. |
| Estanterías | **Paneles holográficos** (idea del usuario): los libros son **ranuras de luz** del color de cada libro en un panel de vidrio oscuro (en la terraza, una placa sobre un pie; en el rincón, empotrado en la pared). Al pasar el cursor (o al enfocar con el teclado) el libro **se proyecta como holograma** encima: la tapa que gira, el título, el autor, el avance y "Abrir". En el celular, el primer toque proyecta y el segundo (o "Abrir") abre. Los libros de luz son cartuchos de cristal de 12×18 (tapa metálica, dos bandas, un emblema) y toda la franja de cada libro es zona de clic. La portada del holograma sale de **10 portadas prediseñadas** (amanecer, ola, luna, árbol, flor, rombos, pluma, montañas, velero, estrella) repartidas al azar sobre el color del libro, sin repetir hasta agotarlas. |
| Paso entre salas | **Una puerta** de la terraza al apartamento, como hoy (puerta futurista; su forma, en la maqueta). |
| HUD | **Holográfico**: paneles celestes claros **un poco transparentes** (≈80 % de opacidad; pedido tras la maqueta), esquinas cortadas en escalón, una línea de luz arriba. La página de lectura queda casi opaca (AAA). |
| Fuente de títulos | **Silkscreen** (elegida en la maqueta). Lectura en Literata e interfaz en Atkinson, como siempre. |
| Página de lectura | **Panel holográfico claro**: blanco celeste opaco, esquinas en diagonal y línea de luz, sobre la terraza nítida y atenuada; la oración que suena, en amarillo solar pálido. |
| Reproductor | **Reproducir es un disco solar** amarillo con rayos de píxel que giran lento al sonar; **la barra es un riel de luz** que se llena, con Pol de perilla. |
| Compañero | **Pol, el dron jardinero**: curioso y científico, con un brazo-regadera; comenta datos ("Capítulo 4 de 12: 33 % polinizado"). Si algo sale bien, zumba y da un loop; ante un error, se le enreda el brazo. El primer diseño (abejorro alargado) no convenció; elegido **Pol peluche**: una bolita amarilla con franjas blancas, visera de ojos grandes, alitas de abeja, brote en la cabeza y la regadera colgando. |
| Taller | **Solo robots, con forma de mascota** (entre robot y adorable, estilo Wall-E o R2-D2, nada humanoide; diseños propios para aprobar antes de dibujarlos). Plantan **un jardín vertical** maceta por maceta, de abajo hacia arriba, con el avance real (uno riega, uno trae plantines, uno poda, uno duerme cargándose…). Al terminar el muro florece, lo suben a la terraza y suena un chime. La cuadrilla: **Tuerca, Domo, Gota, Brote** (reemplaza a Foco) y **Cúpula y Alada** (las variantes de Pol que no quedaron, como robots). **Colores de los robots al azar y sin repetirse**; el color de la voz va en **las flores** que se abren en cada maceta. Paleta de voces **A**: Gonzalo celeste, Jorge hoja, Salomé coral, Salomé grave violeta. |
| Cuadrilla | **Dos Cúpulas** (el robot del taller, en miniatura) traen el libro gigante volando, colgado de dos cables, y lo bajan a su hueco; la segunda se bambolea. Reemplazan a los drones de carga (corrección del usuario al aprobar la maqueta). |
| Libro fallido | **Cortocircuito y reinicio**: el lomo chispea, se apaga, sale humito y se reinicia con una barra de carga y un "ding". Mismos tiempos que el que arde. |
| Descargas | **Cápsula**: un robot por capítulo lleva un cartucho de luz a una cápsula de almacenamiento al pie del atril, que se cierra con un "fsss". En el panel, el medidor es **una batería** cuyas celdas se llenan con el espacio usado. |
| Sonido | **Synth cálido y marimba**: pads luminosos, marimba o kalimba digital y arpegios suaves (Animal Crossing / Mother 3 tranquilo). De día, pájaros y viento en los aerogeneradores; de noche, más lento, con zumbido de ciudad lejana. Pol: bips y trinos de robot. |
| Cómo se trabaja | Primero una **maqueta estática** (portada, azotea, rincón, paneles y página, de día y de noche, con candidatas de fuente y de robots); se ajusta ahí y después se pasa a la app. |

### 7.9 Avance del Solarpunk

- **Maqueta aprobada (02-10-2026)**, en tres rondas (estaba en `apps/web/.scratch/solarpunk/`, ignorada por git). Al aprobarla, el usuario cambió los drones de carga de la cuadrilla por Cúpulas.
- **En la app (02-10-2026)**:
  - **Escenas**: `theme/solarpunk-scenes.js`, el mismo motor de lienzo del Bosque, con portada, terraza y rincón. La base de cada escena lleva colgada su vista de la ciudad (`view`), que sirve para animar solo donde se ve la ciudad: aerogeneradores, tren, teleférico, globo, dirigible, veleros, autos voladores y abejas.
  - **Piezas SVG**: `theme/solarpunk.js`. Los sprites se dibujan en un `Pix` y se pasan a SVG con `svgOf`; los colores "de mentira" (`BOOK`, `VOICE`) salen como `var(--px-book*)` y `var(--px-voice*)`, así un mismo SVG sirve para cualquier libro o voz. Incluye Pol, el taller del jardín vertical (seis robots con colores al azar y las flores del color de la voz), las Cúpulas de la cuadrilla, el cortocircuito, el robotito con su cartucho, la cápsula, los libros de luz y las 10 portadas.
  - **Estantería holográfica**: el registro tiene `bookcase: 'holo'` (`hasHoloBookcase`). `LibraryRoom` dibuja `LightBook` en vez de `Spine` y reparte los estantes con `holoSlotWidth`. El holograma es CSS: se muestra con `:hover`, `:focus-within` o `.is-armed` (el primer toque con el dedo). Las portadas se barajan una vez por visita.
  - **Íconos**: `theme/icons-solarpunk.js` (`SOLAR`), generados con `.scratch/solarpunk/gen-icons.mjs`.
  - **Sonido**: `theme/sound-solarpunk.js` (sintetizador cálido y marimba; Pol con bips y trinos). `sound.js` elige el módulo por mundo (`OWN_SOUND`).
  - **Voz de Pol**: `POL` en `companion-voice.ts`.
  - **Hoja de estilos**: `styles/solarpunk.css`, con Silkscreen (`@fontsource/silkscreen`), los paneles holográficos al 82 %, el disco solar con 4 cuadros de rayos, el riel de luz con Pol, la batería, los interruptores y el riel del volumen. Las imágenes en línea del CSS salen de `.scratch/solarpunk/gen-css-art.mjs`.
- **Probado** en `pnpm dev` con una cuenta de prueba (borrada después): portada, terraza de día y de noche, holograma, ficha, lector, rincón vacío y una subida real, con Pol anunciando la entrega. El taller, la cuadrilla y las descargas se revisaron insertando sus piezas en la página. No se grabó una voz real, para no gastar.
- **Falta**: la revisión completa del usuario y, después, `ready: true`.

