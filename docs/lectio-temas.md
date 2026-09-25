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
- Un **registro de temas** activa uno con `data-theme` y `data-mode` (día o noche) en la raíz, sin recargar.
- El tema **Clásico** es el que ya existe: el sistema de temas se construye alrededor de él sin romperlo.
- La elección se guarda por usuario (hoy en `localStorage`; en la app, en sus preferencias).

## 5. Pendiente de decidir

- Qué tema se construye primero.
- Nombres y personalidad de los compañeros.
- Motivos musicales de cada tema (instrumentación chiptune: laúd y órgano simulados para el scriptorium, arpa y flauta para el bosque, sintetizadores luminosos para el solarpunk).
