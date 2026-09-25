# Informe de Investigación de Mercado y Factibilidad Competitiva: Lectio

**Producto:** Lectio — Biblioteca EPUB Personal con Narración por Voz Neuronal e Higiene Estructural  
**Fecha:** Septiembre 2026  
**Propósito:** Análisis honesto y no complaciente de la competencia, soluciones existentes, limitaciones técnicas de lectura por voz y factibilidad de mercado.

> **Nota sobre las fuentes:** investigación generada con NotebookLM, que no permite exportar las fuentes consultadas; las referencias `[cite: N]` corresponden a su numeración interna y no son verificables externamente. Las cifras de precios y límites deben tratarse como referencia y confirmarse en las páginas oficiales antes de citarlas públicamente. Los datos de proveedores TTS se verificaron por separado, con URLs, en `lectio-decision-tts.md`.

---

## Resumen Ejecutivo

El presente estudio evalúa la viabilidad comercial y técnica de **Lectio**, una propuesta de producto web enfocada en permitir a los usuarios cargar sus propios archivos EPUB para leerlos y escucharlos con voces neuronales de alta calidad, garantizando **sincronización de progreso por capítulos** y una **limpieza estructural profunda del texto** (eliminación de encabezados repetidos, notas al pie interrumptivas, números de página y metadatos).

Tras el análisis de 22 fuentes de mercado, documentación técnica de proyectos open-source y discusiones activas en comunidades de lectores y académicos (Reddit `r/audiobooks`, `r/PhD`, `r/TextToSpeech`, `r/selfhosted`, `r/GradSchool`), la conclusión es categórica:

> **El problema NO está resuelto de manera satisfactoria por las soluciones comerciales SaaS actuales (como Speechify o ElevenReader), y está resuelto únicamente de forma técnica y compleja por soluciones de código abierto / self-hosted (como Storyteller, Audiblez o Calliope).**
>
> *Matiz (ver Anexo A):* existen herramientas comerciales de nicho académico (Listening.com, Audemic, Paper2Audio, el filtrado "Smart Filtering AI" de NaturalReader) que sí omiten citas, pero están orientadas a papers y PDF, no a una biblioteca EPUB con estructura de capítulos y progreso sincronizado entre lectura y audio.

Existe una **brecha estratégica clara en el mercado** entre dos extremos:
1. **SaaS Comerciales**: Tienen excelente calidad vocal y alta facilidad de uso, pero tratan a los libros como documentos de texto plano, aplican un filtrado superficial, imponen suscripciones elevadas ($139–$159/año) con límites ocultos de palabras y destruyen la experiencia narrativa en libros complejos.
2. **Herramientas Open Source / Self-Hosted**: Tienen un parsing semántico impecable del código XHTML/EPUB y sincronización exacta, pero exigen conocimientos técnicos avanzados (Docker, terminal, entornos Python, GPUs dedicadas) que resultan prohibitivos para el usuario medio.

---

## 1. Aplicaciones y Servicios Existentes (Competencia Directa e Indirecta)

El panorama competitivo se divide entre plataformas comerciales en la nube y herramientas comunitarias de código abierto.

### A. SaaS Comerciales y Aplicaciones de Consumo Masivo

*   **Speechify**:
    *   **Enfoque**: Es el líder de visibilidad en lectura asistida y accesibilidad (TDAH/Dislexia).
    *   **Capacidades**: Ingesta EPUB, PDF, enlaces web y fotos (OCR). Ofrece más de 1,000 voces en 60+ idiomas, incluyendo voces de celebridades (Snoop Dogg, Gwyneth Paltrow) y aceleración hasta 4.5x (900 wpm).
    *   **Deficiencias**: No realiza una limpieza semántica real del árbol de documentos EPUB. Aplica heurísticas básicas que fallan sistemáticamente en textos estructurados, leyendo notas al pie, DOIs y encabezados en medio de párrafos.
*   **ElevenReader (ElevenLabs)**:
    *   **Enfoque**: Aplicación móvil/web centrada en la máxima fidelidad acústica.
    *   **Capacidades**: Integra los modelos de síntesis de ElevenLabs con más de 1,000 voces hiperrealistas en 32 idiomas. Admite EPUB, PDF, TXT y DOCX.
    *   **Deficiencias**: Funciona como un reproductor de lectura plana (*flat read*). Carece de un motor de filtrado sintáctico, por lo que reproduce textualmente cualquier "ruido" presente en el documento.
*   **Readwise Reader**:
    *   **Enfoque**: Aplicación de tipo *read-it-later* diseñada para lectores intensivos, investigadores y flujos de trabajo de gestión de conocimiento (PKM).
    *   **Capacidades**: Centraliza artículos web, RSS, newsletters, PDFs y EPUBs. Incluye TTS neuronal con resaltado sincronizado y un copiloto de IA (Ghostreader).
    *   **Deficiencias**: Está optimizado para tomar notas, subrayar y exportar hacia herramientas como Obsidian o Notion. No está diseñado como una biblioteca de audiolibros orientada al consumo prolongado por capítulos.
*   **Voice Dream Reader & NaturalReader**:
    *   **Voice Dream Reader**: Referente histórico en accesibilidad iOS. Permite configurar áreas de exclusión manuales y fuentes disléxicas, pero cambió a un modelo de suscripción contestado por los usuarios y su interfaz es densa.
    *   **NaturalReader**: Herramienta tradicional con filtrado básico de paréntesis, pero con voces menos expresivas en su plan estándar y una interfaz percibida como anticuada.

### B. Proyectos Open Source, Self-Hosted y Herramientas Indies

*   **Storyteller (v2)**:
    *   **Concepto**: Plataforma *self-hosted* (licencia MIT) diseñada para recrear una experiencia privada equivalente al *Whispersync* de Amazon.
    *   **Mecanismo**: Recibe un EPUB y un archivo de audio (o lo sintetiza), utilizando Whisper para alinear texto y audio mediante el estándar abierto **EPUB 3 Media Overlays** (archivos SMIL). Permite alternar entre leer y escuchar con resaltado a nivel de oración.
    *   **Barrera**: Requiere un servidor propio gestionado mediante Docker, espacio en disco y capacidad de cómputo.
*   **Audiblez**:
    *   **Concepto**: Utilidad en Python (CLI y GUI `audiblez-ui`, licencia MIT) para convertir EPUBs en audiolibros formateados en `.m4b` con marcas de capítulo.
    *   **Mecanismo**: Utiliza el modelo neuronal local **Kokoro-82M** (Apache 2.0, 82 millones de parámetros). Procesa el EPUB dividiéndolo por capítulos XHTML. En una GPU NVIDIA T4 procesa un libro completo (~160,000 caracteres) en 5 minutos; en CPU toma ~1 hora.
    *   **Barrera**: Genera únicamente un archivo de audio estático `.m4b`. No incluye interfaz web de lectura sincronizada en tiempo real.
*   **Calliope**:
    *   **Concepto**: Framework académico de código abierto (arXiv 2026, OsloMet/SimulaMet) para convertir EPUBs en archivos *EPUB 3 Media Overlays*.
    *   **Mecanismo**: Calcula marcas de tiempo exactas directamente durante el proceso de síntesis TTS (con motores como *XTTS-v2* o *Chatterbox*), garantizando **desviación cero (0 ms drift)** entre el audio y el resaltado visual, preservando la tipografía y maquetación original del editor.
    *   **Barrera**: Es una biblioteca de línea de comandos en Python sin interfaz gráfica ni plataforma web.
*   **Abogen**:
    *   **Concepto**: Herramienta local (PyQt6 / WebUI Flask) basada en Kokoro-82M que convierte EPUBs, PDFs y Markdown a audio con subtítulos sincronizados, soporte de marcadores de capítulo e integración con Audiobookshelf.

---

## 2. Lectores Genéricos, Motores TTS de SO y el Problema del Parsing Estructural

Un archivo EPUB no es un documento de texto plano; es un contenedor comprimido (ZIP/OCF) que aloja archivos XHTML, hojas de estilo CSS, tablas de contenido XML (NCX o Nav Document) y archivos de metadatos (OPF).

Los lectores de pantalla genéricos (VoiceOver, TalkBack, Microsoft Edge Read Aloud) y las apps de lectura tradicionales (Moon+ Reader, ReadEra, FBReader) cometen el error de extraer linealmente la totalidad del texto contenido dentro de la etiqueta `<body>` de los archivos XHTML. Esta extracción ciega genera **cuatro fallos críticos durante la escucha**:

1.  **Lectura de Encabezados y Números de Página Intercalados**: En maquetaciones que replican el libro físico, los lectores genéricos leen literalmente títulos superiores de capítulo repetidos al inicio de cada sección XHTML o números de página situados a mitad de un párrafo.
2.  **Destrucción del Flujo por Notas al Pie**: Al encontrar una llamada a nota (`<aside>`, `<footnote>` o `epub:type="footnote"`), la lectura lineal interrumpe abruptamente la frase principal para narrar el texto completo de la nota al pie antes de regresar al flujo original, arruinando la coherencia sintáctica.
3.  **Inclusión de Metadatos y Citas Bibliográficas**: Se leen de forma ininterrumpida cadenas como DOIs, URLs, avisos de copyright y citas académicas densas entre paréntesis (ej. *"García et al., 2021, p. 112"*).
4.  **Incapacidad para Navegar por la Tabla de Contenidos Real**: Al no interpretar el árbol del documento, las apps leen páginas de licencias, portadas, dedicatorias e índices de materias como si fuesen capítulos de la narrativa.

---

## 3. Ecosistemas Comerciales Cerrados y Restricciones de DRM

Las plataformas comerciales tradicionales funcionan como "jardines amurallados" (*walled gardens*) protegidos por derechos de autor:

*   **Amazon (Kindle / Audible / Whispersync for Voice)**:
    *   Es el estándar de oro en sincronización entre lectura e audio.
    *   **Restricción**: Exige la compra doble (e-book en Kindle + audiolibro en Audible). Aunque la función *"Send to Kindle"* permite subir EPUBs personales, Amazon los trata como "Documentos Personales", **bloqueando la narración sintética neuronal por capítulos** y la sincronización Whispersync para este contenido externo.
*   **Spotify**: Restringe los audiolibros exclusivamente a su catálogo comercial licenciado. No permite la carga de archivos EPUB del usuario ni ofrece motores de lectura por voz.
*   **Google Play Books**: Permite subir EPUBs/PDFs propios a la biblioteca personal, pero su función de lectura en voz alta recurre a los sintetizadores nativos del sistema operativo (voces robóticas, sin saneamiento ni sincronización en la nube).
*   **Apple Books**: Ofrece narración sintética con IA únicamente para títulos independientes de su tienda oficial; no permite aplicar estos modelos a archivos subidos localmente por el usuario.

---

## 4. Análisis de Sentimiento en Comunidades de Usuarios (Reddit y Foros)

El análisis de discusiones en foros especializados (`r/audiobooks`, `r/PhD`, `r/TextToSpeech`, `r/selfhosted`, `r/GradSchool`) revela una profunda insatisfacción con el estado de la oferta actual:

### Matriz de Puntos de Dolor Identificados

| Categoria | Frustración Específica del Usuario | Impacto en la Experiencia | Comunidades de Origen |
| :--- | :--- | :--- | :--- |
| **Precios y Monetización** | Precios elevados ($139–$159/año en Speechify), renovación automática engañosa y **límites ocultos de palabras en voces HD** (topes de 150k a 1M palabras/mes). | Sensación de engaño comercial, abandono de suscripciones y migración hacia alternativas *open source*. | `r/audiobooks`, `r/TextToSpeech`, `r/PhD` |
| **Interrupción Narrativa** | Lectura textual de notas al pie, números de página, encabezados repetidos, DOIs y tablas. | Pérdida total de la inmersión narrativa, fatiga mental y necesidad de saltar manualmente. | `r/PhD`, `r/GradSchool`, `r/TextToSpeech` |
| **Falta de Sincronización Real** | Apps que generan audio pero no sincronizan la posición entre el reproductor de audio y el lector visual. | Imposibilidad de alternar fluidamente entre leer en el transporte público y escuchar conduciendo. | `r/selfhosted`, `r/audiobooks` |
| **Complejidad Técnica** | Herramientas potentes (Storyteller, Audiblez) que exigen configurar Docker, Python o GPUs. | El usuario común sin perfil técnico queda excluido de estas soluciones de alta calidad. | `r/selfhosted`, `r/eBooks` |

---

## 5. Evaluación de la Competencia Directa y Matriz Comparativa

### Matriz de Competidores

| Aplicación / Herramienta | Ingesta de EPUB Personal | Mecanismo de Sincronización | Calidad Vocal | Higiene y Limpieza Estructural | Modelo de Monetización | Barrera de Entrada |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Speechify** | Sí (EPUB, PDF, OCR) | Resaltado activo palabra por palabra | Muy Alta (Modelos cloud/celebridades) | **Deficiente / Heurística limitada** | Suscripción ($139–$159/año) con topes de palabras | Muy Baja (App Web/Móvil) |
| **ElevenReader** | Sí (EPUB, PDF, DOCX) | Scroll visual en reproductor | **Excepcional** (Motor ElevenLabs) | **Nula (Lectura plana sin saneamiento)** | Freemium (10h/mes gratis) / Ultra ($11/mes) | Muy Baja (App Web/Móvil) |
| **Readwise Reader** | Sí (EPUB, PDF, RSS) | Resaltado activo integrado | Alta (Voces neuronales) | Moderada (Optimizada para artículos) | Suscripción (~$12/mes) | Muy Baja (App Web/Móvil) |
| **Storyteller v2** | Sí (EPUB + Audio) | Nativa vía EPUB 3 Media Overlays (SMIL) | Variable (Depende del backend TTS) | **Muy Alta (Parsing XHTML del EPUB)** | Gratuito / Open Source (MIT) | **Muy Alta (Requiere Docker y servidor)** |
| **Audiblez** | Sí (EPUB) | Sin sincronización visual (exporta M4B) | Alta (Modelo Kokoro-82M) | **Alta (Parseo por capítulos XHTML)** | Gratuito / Open Source (MIT) | **Alta (Uso de CLI/GUI Python local)** |
| **Calliope** | Sí (EPUB) | Sincronización exactísima (0 ms drift) | Alta (XTTS-v2 / Chatterbox) | **Excepcional (Preserva maquetación)** | Gratuito / Open Source (MIT) | **Muy Alta (Script de terminal en Python)** |

### Comparativa Técnica de Estrategias de Extracción de Texto

1.  **Lectura Lineal de Texto Plano** (*ElevenReader, TTS básicos*):
    *   *Ventaja*: Cero latencia de procesamiento inicial.
    *   *Desventaja*: Convierte la narración en una secuencia caótica al leer elementos de maquetación y notas al pie a mitad de frase.
2.  **Filtrado Heurístico Basado en Reglas / Regex** (*Speechify, NaturalReader*):
    *   *Ventaja*: Fácil de implementar en capas superficiales.
    *   *Desventaja*: Alta tasa de falsos positivos y negativos ante maquetaciones complejas o no estandarizadas.
3.  **Parsing Semántico del Árbol Documental (AST/DOM)** (*Storyteller, Calliope, Lectio*):
    *   *Ventaja*: Inspecciona las etiquetas XHTML (`<section>`, `<header>`, `<footer>`, `<aside>`, `epub:type="footnote"`). Extrae la corriente narrativa principal, aísla las notas al pie y respeta la jerarquía real de capítulos.
    *   *Desventaja*: Requiere un motor de procesamiento sintáctico dedicado antes de enviar el texto al sintetizador de voz.

---

## 6. Conclusión Honesta y Recomendación Estratégica

### Veredicto del Mercado

El mercado de la conversión de EPUBs a audio mediante inteligencia artificial se encuentra **profundamente fragmentado y desatendido en su punto medio**:

*   **Los grandes actores comerciales (Speechify, ElevenReader)** han invertido millones en marketing y en conseguir las mejores voces neuronales del mercado, pero han descuidado la higiene estructural del texto en libros (el filtrado de citas existe en herramientas académicas de nicho, orientadas a PDF; ver Anexo A). Tratan un libro como si fuese un sitio web plano, cobrando tarifas desproporcionadas que generan frustración y abandono en los usuarios.
*   **La comunidad Open Source (Storyteller, Audiblez, Calliope)** ha resuelto de forma brillante el parsing semántico de archivos EPUB, la generación de audiolibros por capítulos y la sincronización precisa mediante el estándar *EPUB 3 Media Overlays*. Sin embargo, estas herramientas permanecen confinadas al ámbito de usuarios técnicos capaces de desplegar contenedores Docker o ejecutar scripts en Python.

### Oportunidad Comercial para Lectio

Existe un **espacio legítimo, defensible y de alta demanda** para una aplicación web que combine:

1.  **Simplicidad SaaS**: Cargar un EPUB propio desde cualquier navegador o móvil sin configuraciones técnicas ni servidores personales.
2.  **Motor de Higiene Estructural Inteligente**: Parsing sintáctico del árbol XHTML para eliminar encabezados repetidos, números de página, avisos legales y gestionar las notas al pie de forma no destructiva antes de narrar.
3.  **Síntesis Vocal Neuronal Eficiente**: Uso de modelos de síntesis modernos de bajo costo y alta calidad (como *Kokoro-82M* o *Chatterbox*).
4.  **Sincronización Bimodal (Leer y Escuchar)**: Guardado de progreso sincronizado por capítulos y oraciones para cambiar fluidamente entre la lectura visual y la escucha.

**Recomendación**: La propuesta de valor de Lectio no debe competir en gastar en marketing masivo con celebridades, sino en **posicionarse como la única biblioteca EPUB que entiende la estructura del libro y sincroniza leer y escuchar**. Omitir citas y notas es el mínimo esperable (ya lo hacen herramientas académicas); la ventaja está en combinarlo con capítulos reales, lectura no destructiva y progreso unificado.

---

## Anexo A — Precios, límites y competidores académicos

*Fuente: respuesta complementaria de NotebookLM (septiembre 2026). Sin verificar; algunas cifras llegaron con el formato corrupto en la exportación y se reconstruyeron. Confirmar en las páginas oficiales antes de uso público.*

### A.1 SaaS comerciales

| Producto | Precio | Límites y observaciones |
|---|---|---|
| **Speechify** | $139–159,99/año (~$11,58–13,33/mes); mensual ~$29 (variantes de $11,99–24,99 según app) | Tope de **150.000 palabras/mes con voces HD** (Términos, sección 6.3), después degrada a voz estándar; soporte habría extendido hasta 1M palabras en casos puntuales. Offline limitado a 25 páginas. Prueba de 3 días (7 en promociones); quejas recurrentes por cobros automáticos y negativas de reembolso. |
| **ElevenReader** | Gratis: 10 h/mes de conversión de archivos propios (~1 libro). **Ultra: $11/mes o $99/año (~$8,25/mes)** | Ultra: importación y lectura ilimitada de EPUB/PDF/TXT/DOCX propios, offline, voces personalizadas, 20 h/mes de catálogo comercial. **Es el precio de referencia contra el que compite Lectio.** |
| **Readwise Reader** | $9,99/mes (anual, $119,88) o $12,99/mes | 30 días de prueba sin tarjeta; 50 % de descuento académico. EPUB, PDF, web, RSS, newsletters, YouTube; copiloto Ghostreader. |
| **Nook Listen** | $5/mes o $39/año | Prueba de 3 días sin tarjeta. |
| **NaturalReader** | Plan gratuito restringido; "Smart Filtering AI" desde $9,99/mes | Filtrado inteligente de contenido (alcance real no evaluado). |
| **Aura Reader** (Mac) / **Audiary** (iOS) | Pago único: ~$10 de por vida / $6,99 | — |

### A.2 Competidores de nicho académico (omiten citas)

| Producto | Precio | Enfoque |
|---|---|---|
| **Listening.com** | $3,25/mes ($39/año) o $12,99/mes | Diseñado para omitir citas explícitamente en artículos académicos. |
| **Audemic Scholar** | $119/año | Lectura de papers. |
| **Paper2Audio** | Gratis hasta 250 páginas; pago o dividir el PDF para más | Conversión de PDF académicos. |

**Implicancia para Lectio:** estos productos validan que el filtrado de citas tiene demanda (y que la gente paga por él), pero atacan PDF y papers. Ninguno se describe como biblioteca EPUB con capítulos reales y progreso sincronizado. El riesgo es que alguno se expanda a EPUB; el diferenciador debe apoyarse en la estructura del libro y la sincronización, no solo en la limpieza.

### A.3 Rendimiento y licencias de modelos abiertos

- **Audiblez / Kokoro-82M:** ~160.000 caracteres en ~5 min en GPU T4 (~600 caracteres/s); ~1 h en CPU gama media o Apple M2 (~60 caracteres/s).
- **Licencias:** Kokoro-82M (Apache 2.0) y Chatterbox (MIT) permiten uso comercial. **XTTS v2 (CPML) es estrictamente no comercial**, y como Coqui cerró en enero de 2024 no hay forma de adquirir licencia. Calliope, citado en la sección 1.B, usa XTTS-v2 entre sus motores; esto no afecta a Lectio, que no lo usará.

Análisis de costos y decisión de proveedor: `lectio-decision-tts.md`.
