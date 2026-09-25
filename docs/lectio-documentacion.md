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
