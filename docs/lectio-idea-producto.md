# Lectio — Idea de Producto

## 1. El problema (en una frase)

Leer EPUB hoy es una experiencia desconectada de tu progreso real: los lectores tratan el libro como un documento plano, y cuando ofrecen narración por voz, suena robótica y no respeta la estructura del libro (capítulos, secciones, contexto).

## 2. La solución (en una frase)

Una biblioteca personal donde cada libro se procesa para entender su estructura real, y se puede escuchar con voz natural que respeta esa estructura — sin repeticiones, sin ruido, con tu progreso siempre guardado.

## 3. Para quién es

- Personas que leen EPUB de forma habitual y quieren alternar entre leer y escuchar el mismo libro (ej. leer en casa, escuchar en el gym o manejando).
- Personas con dificultad o cansancio visual que prefieren el audio pero odian las voces robóticas de los lectores de pantalla genéricos.
- Lectores que ya tienen su propia colección de EPUB (comprados, de dominio público, etc.) y no quieren depender de un catálogo cerrado como Audible o Spotify.

## 4. Propuesta de valor funcional

| Función | Por qué importa |
|---|---|
| Parseo estructural real del EPUB | No es "página 47 de 320", es "Capítulo 3: El despertar" — contexto real, no numeración arbitraria. |
| Narración con voz neuronal natural | Se siente como escuchar a alguien leer, no a una máquina deletreando texto. |
| Texto limpio antes de narrar | Sin repetir el título del libro en cada sección, sin leer números de página sueltos. |
| Progreso unificado lectura/audio | Dejas de leer en el bus, sigues escuchando en el gym, desde el mismo punto. |
| Biblioteca 100% tuya | Tus propios archivos EPUB, no dependes de que el libro esté en un catálogo de terceros. |

## 5. Ángulo comercial (hipotético, para explorar)

> Nota: esto es exploratorio — el MVP no incluye monetización real, pero vale la pena pensarlo para entender si el producto tiene piernas más allá de portafolio.

- **Modelo freemium por consumo de TTS**: X caracteres/mes gratis, luego plan pago. Encaja naturalmente porque ya se está registrando el consumo desde el MVP.
- **Diferenciador frente a lectores de pantalla genéricos** (Voice Dream Reader, @Voice, lectores nativos de iOS/Android): estos leen el texto tal cual viene, sin limpieza estructural ni comprensión del libro como objeto con capítulos.
- **Diferenciador frente a audiolibros (Audible, Spotify)**: no dependes de que el libro exista como audiolibro comercial — cualquier EPUB que ya tengas se vuelve "audiolibro" al instante.
- **Riesgo comercial evidente**: el nicho de "quiero convertir MIS propios EPUB en audio" es más chico que el de audiolibros comerciales. Esto es una señal, no un obstáculo — hay que confirmar si existe demanda real o si el problema ya está resuelto por alguien.

## 6. Lo que NO se sabe todavía (y por eso esto es exploratorio)

- Si existen apps que ya resuelven exactamente esto (biblioteca EPUB + TTS estructural), y qué tan bien lo hacen.
- Si el problema es lo suficientemente doloroso para que la gente pague, o si es un "nice to have".
- Si hay una razón técnica/legal por la que nadie lo ha hecho bien todavía (derechos de autor sobre narración, por ejemplo).

---

## 7. Prompt de investigación para NotebookLM

Copia y pega esto en NotebookLM (o en cualquier herramienta con búsqueda web) para investigar competencia antes de comprometerte más a fondo:

```
Quiero investigar si existe un mercado ya cubierto para la siguiente idea de producto, y necesito un análisis honesto de competencia, no una validación complaciente.

IDEA DE PRODUCTO:
Una aplicación web que permite a un usuario subir sus propios archivos EPUB a una
biblioteca personal. La app analiza la estructura real del libro (tabla de
contenidos, capítulos), limpia el texto de ruido (encabezados repetidos,
numeración de página) y genera narración por voz neuronal natural para cada
capítulo, permitiendo alternar entre leer y escuchar el mismo libro con el
progreso sincronizado. No es un catálogo de audiolibros comerciales: el usuario
usa sus propios archivos EPUB (comprados, de dominio público, etc.).

LO QUE NECESITO QUE INVESTIGUES:

1. Aplicaciones o servicios existentes que hagan esto mismo o algo muy similar
   (biblioteca EPUB personal + conversión a audio con voz neuronal, respetando
   la estructura del libro). Incluye tanto apps conocidas como herramientas de
   nicho o proyectos indie/open source.

2. Lectores de pantalla / TTS genéricos que la gente usa hoy para este mismo
   propósito (leer sus propios EPUB en voz alta), y qué tan bien o mal resuelven
   el problema de la estructura del libro (capítulos, numeración, repeticiones).

3. Apps de audiolibros comerciales (Audible, Spotify, Google Play Books, etc.)
   y si alguna permite subir contenido propio (no solo catálogo comercial).

4. Cualquier discusión en foros (Reddit, Hacker News, foros de lectores/EPUB,
   comunidades de accesibilidad) donde la gente se queje explícitamente de este
   problema: voces robóticas, falta de contexto de capítulos, mala narración de
   sus propios PDFs/EPUB.

5. Si encuentras competencia directa, evalúa: ¿qué tan bien resuelven el
   problema de la "limpieza estructural" del texto antes de narrar? ¿Cobran?
   ¿Qué tan buena es la calidad de voz que usan?

6. Una conclusión honesta: ¿este problema ya está bien resuelto por alguien,
   está mal resuelto por varios, o prácticamente no hay nadie atacándolo
   directamente?

No necesito que me convenzas de construir esto. Necesito el panorama real,
incluyendo si la conclusión es que ya existe una solución muy buena.
```

---

## 8. Qué hacer con el resultado

Cuando tengas la investigación de NotebookLM, hay tres escenarios posibles:

1. **No hay competencia directa real** → seguimos con el MVP tal como está diseñado, con más confianza.
2. **Hay competencia, pero resuelve mal el problema** → seguimos, pero afinamos el "diferenciador" (probablemente la limpieza estructural del texto sea tu ventaja real).
3. **Hay competencia que ya lo resuelve muy bien** → no es motivo para abandonar el proyecto de portafolio (el valor de aprendizaje técnico sigue intacto), pero sí ajustamos el discurso: de "resuelvo un problema sin resolver" a "construí mi propia versión de X, con estas decisiones técnicas".
