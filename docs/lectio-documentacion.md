# Lectio — Documentación del Proyecto (MVP)

*Biblioteca personal de EPUB con lectura narrada por voz natural*

---

## 1. Resumen ejecutivo

Los lectores de EPUB actuales tratan el libro como un documento genérico: no distinguen capítulos reales de encabezados repetidos, no ofrecen narración por voz de calidad, y cuando la ofrecen, ignoran la estructura del libro (leen el mismo título en cada página, pierden el contexto de "dónde vamos").

**Lectio** es una biblioteca personal de libros EPUB que parsea la estructura real del libro (capítulos según su tabla de contenidos) y permite escucharlo con voz neuronal natural, respetando esa estructura — sin ruido, sin repeticiones, con progreso guardado por capítulo.

---

## 2. Objetivos

### 2.1 Objetivo general
Construir una plataforma web multi-usuario que permita subir libros EPUB, organizarlos en una biblioteca personal, leerlos y escucharlos con narración de voz natural generada automáticamente a partir de la estructura real del libro.

### 2.2 Objetivos específicos
- OE-01: Parsear la estructura de un EPUB (metadata, tabla de contenidos, capítulos) de forma automática al subirlo.
- OE-02: Generar audio narrado por capítulo mediante un servicio de TTS, limpiando artefactos de texto (headers/footers repetidos, numeración de página).
- OE-03: Persistir el progreso de lectura/escucha del usuario por capítulo, no por "página física".
- OE-04: Registrar el consumo de caracteres procesados por TTS por usuario, como base para un futuro modelo de límites/planes.
- OE-05: Soportar múltiples usuarios con bibliotecas privadas e independientes.

### 2.3 Objetivos de aprendizaje (para el portafolio)
- Aplicar procesamiento de archivos y jobs asíncronos con colas (BullMQ + Redis) en NestJS.
- Diseñar una integración con un servicio externo (TTS) detrás de una interfaz, siguiendo principios de arquitectura hexagonal.
- Modelar un dominio no trivial (Libro → Capítulo → Progreso → Segmento de audio) en lugar de un CRUD plano.
- Practicar autenticación/autorización multi-usuario con NestJS Guards.

---

## 3. Alcance

### 3.1 Dentro del alcance (MVP)
- Registro/login de usuario (JWT).
- Subida de archivos EPUB.
- Parseo automático de estructura (metadata + tabla de contenidos vía `toc.ncx` / `nav.xhtml`).
- Biblioteca personal: listado de libros con portada, autor, progreso.
- Lector de texto por capítulo, con posición de lectura guardada.
- Generación de audio por capítulo vía TTS (Edge TTS, con Kokoro como respaldo), en background (cola de trabajos), con cuota mensual por usuario.
- Reproductor de audio con control de velocidad, sincronizado a la posición del capítulo.
- Contador de consumo de caracteres TTS por usuario.
- **Biblioteca pública de dominio público**: catálogo de libros de dominio público (ej. clásicos de Cervantes, Poe, etc.) precargados y procesados por el equipo, accesibles y escuchables sin necesidad de registro. Funciona simultáneamente como contenido de prueba durante el desarrollo y como estrategia de crecimiento orgánico (SEO) tras el lanzamiento.

### 3.2 Fuera de alcance (versiones futuras)
- **Soporte para PDF** — decisión confirmada tras el estudio de mercado (ver `informe-estudio-mercado-lectio.md`). El diferenciador de Lectio es el parsing semántico del árbol XHTML/OPF/NCX propio del EPUB; el PDF carece de esa estructura y forzaría un enfoque heurístico (posición X/Y, tamaño de fuente) similar al de Speechify, que el propio estudio identifica como el punto débil de la competencia comercial. Añadir PDF ahora diluiría la ventaja competitiva antes de consolidarla en EPUB. Se reevalúa en v1.1 como un motor de heurísticas independiente.
- Resúmenes, chat con el libro, recomendaciones por IA.
- Sincronización en tiempo real entre dispositivos (WebSockets).
- Notas / highlights colaborativos.
- Voice cloning o voces personalizadas.
- Planes de pago reales (se aplica una cuota gratuita mensual y se registra el consumo, pero no se cobra).

---

## 4. Actores

| Actor | Descripción |
|---|---|
| Usuario registrado | Persona con cuenta propia; sube libros, los lee/escucha, ve su progreso y su consumo de TTS. |
| Sistema de procesamiento (worker) | Componente interno que ejecuta el parseo de EPUB y la generación de audio de forma asíncrona. |
| Servicio externo TTS (Edge TTS; Kokoro como respaldo) | Proveedor externo consumido por el sistema para convertir texto a voz. |

---

## 5. Requisitos funcionales

| ID | Requisito |
|---|---|
| RF-01 | El sistema debe permitir a un usuario registrarse con correo y contraseña. |
| RF-02 | El sistema debe permitir a un usuario autenticarse y recibir un token de sesión (JWT). |
| RF-03 | El sistema debe permitir subir un archivo EPUB válido a la biblioteca del usuario autenticado. |
| RF-04 | El sistema debe extraer automáticamente metadata del EPUB (título, autor, portada) al subirlo. |
| RF-05 | El sistema debe extraer la tabla de contenidos real del EPUB y dividir el libro en capítulos. |
| RF-06 | El sistema debe rechazar o marcar como inválido un EPUB sin tabla de contenidos reconocible. |
| RF-07 | El sistema debe listar los libros de la biblioteca del usuario autenticado, y solo los suyos. |
| RF-08 | El sistema debe permitir leer el texto de un capítulo específico. |
| RF-09 | El sistema debe guardar automáticamente la posición de lectura (capítulo + offset) del usuario en cada libro. |
| RF-10 | El sistema debe permitir solicitar la generación de audio de un capítulo. |
| RF-11 | La generación de audio debe ejecutarse de forma asíncrona (cola), sin bloquear al usuario. |
| RF-12 | El sistema debe notificar (vía polling o estado consultable) cuándo el audio de un capítulo está listo. |
| RF-13 | El sistema debe remover del texto, antes de enviarlo a TTS, encabezados de capítulo repetidos y números de página intercalados a mitad de párrafo. |
| RF-14 | El sistema debe identificar notas al pie (`epub:type="footnote"`, `<aside>`) y excluirlas del flujo narrativo principal, en lugar de leerlas intercaladas donde interrumpen la frase original. |
| RF-15 | El sistema debe excluir del texto narrado metadatos y referencias bibliográficas densas (DOIs, avisos de copyright, citas tipo "Autor et al., año, p. N") que no aportan a la narrativa. |
| RF-16 | El sistema debe excluir de la lista de "capítulos narrativos" las secciones no narrativas de front-matter reconocibles en la tabla de contenidos (portada, página de licencia, dedicatoria, índice de materias), sin depender de que el usuario las descarte manualmente. |
| RF-17 | El sistema debe permitir reproducir el audio generado de un capítulo, con control de velocidad de reproducción. |
| RF-18 | El sistema debe registrar los caracteres de texto enviados a TTS por usuario, de forma acumulada. |
| RF-19 | El sistema debe permitir a un usuario consultar su consumo de TTS: total acumulado y del periodo mensual en curso (consumido, reservado y restante). |
| RF-20 | El sistema debe permitir marcar un libro como "público" (dominio público), haciéndolo accesible para lectura y escucha sin necesidad de autenticación. |
| RF-21 | El sistema debe listar los libros públicos en una vista independiente, indexable por motores de búsqueda. |
| RF-22 | El sistema debe permitir generar audio únicamente por capítulo individual; no debe existir una operación para generar el audio de un libro completo en una sola solicitud. |
| RF-23 | El sistema debe aplicar una cuota mensual de caracteres TTS por usuario, verificada antes de encolar la generación (incluyendo las solicitudes ya encoladas), e informar al usuario los caracteres restantes. |
| RF-24 | El sistema debe limitar la cantidad de capítulos que un usuario puede tener en cola o en proceso de generación de audio al mismo tiempo. |

---

## 6. Requisitos no funcionales

| ID | Requisito |
|---|---|
| RNF-01 | La generación de audio no debe bloquear ninguna otra operación del sistema (debe ser asíncrona vía cola). |
| RNF-02 | El acceso a los libros y audios debe estar restringido estrictamente al usuario propietario. |
| RNF-03 | El servicio de TTS debe estar desacoplado detrás de una interfaz/puerto, para poder sustituirlo (Azure, Google, etc.) sin afectar el resto del sistema. |
| RNF-04 | El sistema debe manejar de forma controlada fallos o indisponibilidad del proveedor de TTS (reintentos, estado de error visible). |
| RNF-05 | El backend debe estar razonablemente cubierto por pruebas automatizadas en la lógica de dominio (parseo, cálculo de progreso). |
| RNF-06 | El sistema debe ser desplegable de forma independiente por app (API y Web) desde un monorepo. |
| RNF-07 | La carga total enviada al proveedor de TTS debe estar acotada a nivel de sistema (concurrencia y frecuencia máximas del worker), independiente de la cantidad de usuarios activos. |

---

## 7. Casos de uso

### UC-01 — Registrar cuenta
- **Actor:** Usuario
- **Flujo principal:** El usuario ingresa correo y contraseña → el sistema valida unicidad del correo → crea la cuenta → responde con confirmación.
- **Flujo alterno:** Correo ya registrado → el sistema responde con error de conflicto.

### UC-02 — Iniciar sesión
- **Actor:** Usuario
- **Flujo principal:** El usuario ingresa credenciales → el sistema las valida → emite un JWT.
- **Flujo alterno:** Credenciales inválidas → error de autenticación.

### UC-03 — Subir un libro
- **Actor:** Usuario autenticado
- **Flujo principal:** El usuario sube un archivo `.epub` → el sistema valida el formato → encola un job de parseo → responde indicando "procesando".
- **Flujo alterno:** Archivo corrupto o sin tabla de contenidos → se marca el libro como inválido y se notifica al usuario.

### UC-04 — Ver biblioteca personal
- **Actor:** Usuario autenticado
- **Flujo principal:** El usuario solicita su biblioteca → el sistema devuelve solo los libros asociados a su cuenta, con portada y progreso.

### UC-05 — Leer un capítulo
- **Actor:** Usuario autenticado
- **Flujo principal:** El usuario abre un libro → el sistema devuelve el último capítulo/posición leída → el usuario navega por capítulos → el sistema guarda la nueva posición al salir o periódicamente.

### UC-06 — Generar audio de un capítulo
- **Actor:** Usuario autenticado / Worker
- **Flujo principal:** El usuario solicita audio para un capítulo → el sistema limpia el texto → encola el job de síntesis → el worker llama al servicio TTS → guarda el archivo de audio resultante → actualiza el estado del capítulo a "audio disponible".
- **Flujo alterno:** El servicio TTS falla → el job se reintenta un número limitado de veces → si falla definitivamente, se marca como error, se libera la cuota reservada y se notifica.
- **Flujo alterno:** Cuota mensual insuficiente o límite de capítulos simultáneos alcanzado → el sistema rechaza la solicitud indicando el motivo y los caracteres restantes.

### UC-07 — Escuchar un capítulo
- **Actor:** Usuario autenticado
- **Flujo principal:** El usuario solicita reproducir un capítulo con audio disponible → el sistema sirve el archivo de audio → el usuario controla velocidad de reproducción → el sistema guarda la posición de escucha.

### UC-08 — Consultar consumo de TTS
- **Actor:** Usuario autenticado
- **Flujo principal:** El usuario solicita su consumo → el sistema devuelve el total de caracteres procesados acumulados.

### UC-09 — Explorar biblioteca pública
- **Actor:** Visitante (sin autenticar) / Usuario autenticado
- **Flujo principal:** El visitante accede a la sección pública → el sistema lista los libros de dominio público disponibles → el visitante puede leer y escuchar el contenido sin necesidad de crear cuenta.

---

## 8. Modelo de dominio preliminar (entidades)

> Este es un primer vistazo; el modelo de datos detallado (con relaciones, tipos y diagrama) se define en el siguiente documento.

- **Usuario**: identidad, credenciales, biblioteca asociada.
- **Libro**: metadata (título, autor, portada), archivo EPUB original, estado de procesamiento.
- **Capítulo**: pertenece a un Libro, contiene el texto limpio, orden, y referencia a su audio (si existe).
- **SegmentoDeAudio**: archivo de audio resultante de un Capítulo, con estado (pendiente/listo/error).
- **ProgresoDeLectura**: por Usuario + Libro, guarda capítulo actual y offset (texto y/o audio).
- **ConsumoTTS**: por Usuario, acumulado de caracteres procesados.

---

## 9. Decisión de proveedor TTS

> Decisión completa, con costos, fuentes y licencias, en `lectio-decision-tts.md`. Aquí solo el resumen.

**MVP / portafolio: Microsoft Edge TTS como proveedor principal**, con **Kokoro-82M vía DeepInfra como segundo adaptador** de respaldo.

- **Edge TTS:** costo cero, buenas voces neuronales en español y marcas de tiempo por palabra. Pero es un servicio **no oficial**: sin SLA, Microsoft lo ha roto varias veces (403 por cambios de token, el más conocido en oct-2024) y su uso comercial queda en zona gris respecto al Microsoft Services Agreement. Aceptable para un proyecto sin usuarios de pago, no para un SaaS.
- **Kokoro-82M (Apache 2.0):** ~$0,31 por libro vía API. Su punto débil es el español (solo 3 voces), no el costo. Como respaldo cubre las caídas de Edge y demuestra que el puerto `TtsProvider` permite cambiar de proveedor de verdad.

**Producción comercial: Kokoro o Chatterbox (MIT), según una prueba a oído en español.** Azure y OpenAI (~$7,50 por libro) quedan descartados: el precio de referencia del mercado (ElevenReader Ultra, ~$8–11/mes ilimitado) no deja margen. XTTS v2 queda descartado por licencia no comercial.

**Mitigación de diseño (sin cambios):** todo proveedor se implementa detrás del puerto `TtsProvider`. Un `TtsProviderRouter` con circuit breaker enruta hacia el respaldo cuando el principal falla.

**Control de consumo:** el audio se genera solo por capítulo y bajo demanda, con cuota mensual por usuario, límite de concurrencia por usuario y un limitador global en la cola. Detalle en `lectio-decision-tts.md` §6.

---

## 10. Estructura del proyecto (monorepo)

**Herramienta recomendada:** pnpm workspaces + Turborepo (en lugar de Nx, que añade una capa de configuración y opinión propia innecesaria para dos aplicaciones).

```
lectio/
├── apps/
│   ├── api/             # NestJS: solo HTTP
│   ├── worker/          # NestJS sin HTTP: consume las colas
│   └── web/             # Frontend (React Router v7 + Vite, PWA)
├── packages/
│   ├── core/            # dominio + aplicación compartidos por api y worker
│   ├── epub-pipeline/   # pipeline de procesamiento de EPUB (lógica pura)
│   └── shared/          # DTOs y tipos compartidos con web
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

Esto te permite correr `api`, `worker` y `web` de forma independiente, compartir tipos sin duplicarlos, y desplegar cada app por separado si más adelante quieres subir esto a producción real.

---

## 11. Estrategia de crecimiento pasivo: biblioteca de dominio público

**Origen de la decisión:** el estudio de mercado (`informe-estudio-mercado-lectio.md`) identifica comunidades con dolor activo y sin solución simple (r/selfhosted, r/PhD, r/TextToSpeech, r/audiobooks), pero también confirma que el mercado carece de una opción simple tipo SaaS que respete la estructura del libro. Una biblioteca pública de clásicos resuelve dos problemas a la vez:

1. **Contenido de prueba real durante el desarrollo**: en vez de usar EPUBs aleatorios para probar el parser y el TTS, se usan libros de dominio público reales, que además ya quedan listos para publicarse.
2. **Adquisición orgánica sin inversión en marketing**: cada libro procesado se indexa como una página propia (SEO), sirve como demo funcional para quien no quiere registrarse todavía, y es el punto de entrada natural para quien busca "escuchar [clásico] en voz natural".

**Alcance de esta funcionalidad en el MVP:** un conjunto reducido de libros de dominio público (ej. 5-10 títulos conocidos), precargados por el equipo (no por usuarios), visibles en una sección separada de la biblioteca personal, sin necesidad de autenticación para leer o escuchar.

**Fuera de alcance por ahora:** que usuarios externos suban contenido para hacerlo público, moderación de contenido, o cualquier mecanismo de curaduría comunitaria — eso es una decisión de producto más compleja que se evalúa después del MVP.

---

## 12. Roadmap por fases

| Fase | Contenido |
|---|---|
| **MVP (v1.0)** | Todo lo descrito en la sección 3.1, incluyendo la biblioteca pública de dominio público |
| **v1.1** | Soporte PDF (con motor de heurísticas propio), mejoras de limpieza de texto, métricas de uso más detalladas |
| **v2.0** | Resúmenes por capítulo con IA, chat con el libro, recomendaciones |
| **v2.1** | Sincronización en tiempo real entre dispositivos, notas/highlights |

---

## 12.1 Ideas a evaluar

*Propuestas del 25-09-2026, surgidas al usar la demo. No están en el roadmap todavía: son alternativas a decidir.*

### A. Temas de pixel art seleccionables

**Idea:** varios temas visuales de pixel art (creados para Lectio) que el usuario elige y que cambian la UI/UX: marcos, botones, íconos, colores y pequeños detalles del reproductor.

**Ambición (precisada el 25-09-2026):** uno o varios temas muy estilizados, con el máximo nivel de diseño, que hagan que la app se sienta **casi como un juego**: la biblioteca, la navegación, el reproductor y las transiciones con identidad de pixel art. La excepción es **todo lo que sea lectura** (el texto del libro, su tamaño, su interlineado y su contraste), que se toca lo mínimo posible para no afectar la lectura.

**Por qué encaja:** el preview ya está construido sobre *tokens* de diseño (variables CSS de color, tipografía y espaciado), así que un tema es, en su mayor parte, otro juego de tokens más sus recursos gráficos. Para el portafolio, además, muestra un sistema de temas real y no solo un modo oscuro.

**Condiciones para que no choque con la dirección visual (§ frontend 2.2):**
- **El texto del libro sigue siendo legible:** las fuentes pixel (tipo *Press Start 2P*) cansan en lectura larga. El pixel art viste la interfaz (marcos, botones, reproductor, íconos, portadillas); el cuerpo del libro sigue en Literata o Atkinson, o en una fuente pixel pensada para leer, si se encuentra una que pase la prueba.
- **Mismas reglas de contraste** (AA en interfaz, AAA en texto) en cada tema, verificadas como ahora.
- `prefers-reduced-motion` desactiva cualquier animación del tema.

**Cómo se haría:** los gráficos se dibujan como SVG con píxeles cuadrados (o CSS), sin imágenes externas, y se escalan con `image-rendering: pixelated`. Cada tema es un archivo con sus tokens y sus recursos, un registro de temas elige el activo (`data-theme`) y la preferencia se guarda por usuario. Primer paso posible: dos temas de prueba en el preview antes de llevarlo a la app.

**A decidir:** cuántos temas y con qué identidad (ej. biblioteca 8-bit, pergamino, noche), si cambian solo lo visual o también microinteracciones y sonidos, y si hay tema por defecto pixel o solo como opción. Requiere una ronda de preguntas de diseño.

### B. Conversor de PDF a EPUB

**Idea:** aceptar PDF convirtiéndolo antes a EPUB, para que entre al mismo pipeline.

**Relación con la decisión actual:** en §3.2 el PDF quedó fuera del MVP porque no trae la estructura semántica que es el diferenciador de Lectio. Un conversor **no elimina ese problema, lo traslada**: el EPUB resultante se parece a un EPUB convertido con Calibre (encabezados y números de página repetidos, guiones de división silábica, capítulos adivinados). Lo bueno es que el pipeline ya tiene reglas pensadas justo para eso (S1, S2 y la unión de guiones de la etapa 9), así que la calidad sería razonable para PDF de texto, no para PDF escaneados.

**Alternativas encontradas (precios y licencias por verificar antes de decidir):**

| Opción | Tipo | Notas |
|---|---|---|
| Calibre (`ebook-convert`) | Gratis, GPL-3 | La más probada. Se ejecuta como proceso aparte en el worker (el GPL no contagia a Lectio por usarse como programa externo). Instalación pesada: encaja en una imagen Docker del worker. |
| Marker | Código abierto, basado en modelos de ML | Convierte PDF a Markdown con buena detección de estructura; habría que pasar luego a EPUB (ej. con pandoc). La licencia de los modelos tiene condiciones para uso comercial: **verificar**. Necesita más recursos (idealmente GPU). |
| APIs de pago (CloudConvert, ConvertAPI, Adobe PDF Services) | Por conversión | Sin infraestructura propia, pero con costo por archivo y dependencia de un tercero. Calidad variable: **probar antes**. |
| pandoc | Gratis | **No lee PDF**: solo sirve como segundo paso (de Markdown a EPUB). |

PDF escaneados (imágenes) necesitarían OCR (ej. OCRmyPDF/Tesseract), que es otro alcance.

**Si se hace:** empezar con Calibre como paso opcional antes del pipeline, marcar esos libros en el reporte como "convertido desde PDF" (clasificación de baja confianza) y medir la calidad con un corpus pequeño de PDF reales antes de prometer nada al usuario.

### C. Navegación en secciones: bienvenida, biblioteca y lectura

**Idea (25-09-2026):** separar la experiencia en pestañas o pantallas claras: una **bienvenida**, una **biblioteca** donde el usuario carga sus EPUB y ve los que ya tiene, y recién entonces la pantalla de **leer o escuchar** un libro.

**Relación con lo diseñado:** la app ya prevé esas pantallas (`lectio-frontend.md` §3: biblioteca pública como portada, mi biblioteca, subir EPUB, detalle del libro, lector y reproductor). Lo nuevo es la **bienvenida** como pantalla propia (qué es Lectio, cómo empezar, un libro de ejemplo para probar) y el orden explícito del recorrido. El preview actual, en cambio, es de un solo libro.

**Paso intermedio posible, antes de la app:** un comando `lectio library` que genere `out/index.html` con todos los libros ya procesados (portadas, duración, cuánto audio tienen) y enlaces a sus previews. Daría la experiencia de biblioteca sin backend y sirve para ensayar el diseño de esa pantalla.

### D. Sección de descargas de audio

**Idea (25-09-2026):** una sección donde queden los audios que el usuario decide descargar.

Hay dos lecturas posibles, no excluyentes, que conviene decidir:
1. **Descargas dentro de la app (sin conexión):** ya prevista en `lectio-frontend.md` §6.3 (Service Worker, capítulos guardados en el dispositivo). Faltaría una **sección propia** para verlas y administrarlas: qué libros y capítulos están descargados, espacio usado, borrar, descargar los próximos N capítulos.
2. **Exportar los archivos** para usarlos fuera de Lectio: MP3 por capítulo, o un único **M4B con marcas de capítulo** (el formato de audiolibro que entienden Apple Books, Smart AudioBook Player o Audiobookshelf). La CLI ya genera MP3 y `playlist.m3u`; el M4B necesitaría ffmpeg.

### E. Naturalidad de la voz

**Hallazgo (25-09-2026, escuchando *Marianela*):** con las correcciones de ritmo, la voz ya no se entrecorta, pero **todavía suena a máquina**. Es un problema de producto de primer orden: el estudio de mercado muestra que la calidad vocal es justo donde compiten ElevenReader y Speechify, y es lo que decide si alguien escucha un libro completo.

**Escalera de opciones, de menor a mayor costo:**

| Opción | Costo aprox. por libro (500k caracteres) | Notas |
|---|---|---|
| Voces **Multilingual** de Edge (Ava, Andrew, Emma, Brian) | Gratis | Más recientes y expresivas que las regionales; hablan español, pero con un leve acento del inglés. Probado: entregan todas las marcas de palabra en español. **Primera prueba a oído, en curso.** |
| Voces **HD** de Azure | ~US$ 11 (US$ 22 / 1M) | Mismo ecosistema que Edge, con una generación de voces más natural. Oficiales. |
| OpenAI `gpt-4o-mini-tts` | ~US$ 8 (≈ US$ 0,015 por minuto) | Se le puede indicar el tono ("narrador de audiolibro, cálido y pausado"). Verificar si entrega marcas de tiempo; si no, alineación aproximada o por oración. |
| Modelos abiertos (Chatterbox multilingüe, Kokoro) | ~US$ 0,1–1 en GPU propia o alquilada | Kokoro es débil en español; Chatterbox multilingüe hay que probarlo a oído. |
| ElevenLabs | Varias veces más caro | Referente de naturalidad; su costo choca con el precio de mercado (`lectio-decision-tts.md` §3.2). |

*Precios de docs/lectio-decision-tts.md y de la investigación del 25-09-2026; verificar antes de decidir.*

**Implicancia:** si ninguna opción gratuita es suficiente, la voz natural pasa a ser un costo por libro, y eso afecta el modelo comercial (cuota gratuita con voz estándar, voz premium en un plan de pago). El puerto `TtsProvider` permite probar cada proveedor sin tocar el pipeline: el siguiente paso sería una **prueba ciega** con el mismo capítulo en 3 o 4 proveedores.

---

## 13. Documentos del proyecto

| Documento | Estado |
|---|---|
| `lectio-idea-producto.md` | Idea y propuesta de valor |
| `informe-estudio-mercado-lectio.md` | Estudio de mercado (NotebookLM) + Anexo A de precios |
| `lectio-documentacion.md` | Este documento: alcance, requisitos, casos de uso |
| `lectio-modelo-datos.md` | Modelo de datos detallado |
| `lectio-arquitectura-api.md` | Arquitectura técnica y contratos de API |
| `lectio-pipeline-limpieza.md` | Pipeline de procesamiento y limpieza de texto |
| `lectio-decision-tts.md` | Decisión de proveedor TTS y control de consumo |
| `lectio-frontend.md` | Diseño del frontend: PWA, lector, reproductor, sincronización y modo sin conexión |
