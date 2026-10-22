# English Cloze · B2 First · Parts 1–4

Versión 1.12.0 · 21/10/2026. **El juego anterior sigue siendo el motor: 15 preguntas por ronda, cuatro opciones, 15 segundos, colores de corrección, progreso, medallas y estadísticas.** No hay ejercicios de respuesta escrita.

## Origen único: los 30 exámenes

El banco activo contiene **900 huecos originales**: 240 de Part 1, 240 de Part 2, 240 de Part 3 y 180 de Part 4. De los 30 exámenes, 01–10 son Cambridge (First Trainer 3 y First for Schools 2) y 11–30 son EngExam, que siguen el formato Cambridge pero no son materiales oficiales de Cambridge. Se usan exclusivamente los enunciados y las soluciones del banco maestro ya disponible en el proyecto `adaptive-exam` y del documento Drive «Cambridge B2 · TRANSCRIPCIÓN MAESTRA · 30 exámenes · Parts 1–4 y soluciones».

- Part 1: cuatro opciones A/B/C/D **originales**, tomadas del examen.
- Parts 2 y 3: fragmentos originales con un hueco, y cuatro opciones de nuestro antiguo banco de entrenamiento, sin cambiar la respuesta documentada; Part 3 conserva la palabra base.
- Part 4: las dos frases originales y la palabra obligatoria, con cuatro fragmentos entre los que elegir. Siempre conservamos la palabra clave y el límite de 2–5 palabras.
- Se corrige con las respuestas originales registradas en la fuente; una sola se muestra como opción válida. En Exam 24, Part 4, Q27, se ajusta excepcionalmente la respuesta `is rumored to be` a `is rumoured to be`, para conservar la palabra obligatoria `RUMOURED` (documentado, no atribuir al solucionario original).
- Se conserva la estructura literal del texto de origen. Cuando una frase contiene otros huecos, estos se completan con las soluciones que ya estaban en el banco; los ejemplos número 0 se identifican como tales, sin inventar su solución.

## Control de calidad y límites

Se han probado los 900 registros por estructura, origen, unicidad de ID, clave y cuatro opciones. La Part 4 aprovecha **24 grupos de distractores revisados anteriormente** y contiene **156 grupos de distractores generados siguiendo reglas gramaticales**, clasificados en `exam-quiz-source-qa.json` como `grammar-traps-provisional`. **Todavía no están auditados uno por uno semánticamente**; nunca presentarlos como 156 juegos de distractores certificados ni como claves oficiales. Las Parts 1–4 sí están cubiertas y funcionan con cuatro opciones.

La transcripción maestra se ha cotejado contra las estructuras almacenadas de Cambridge B2 en el Hub, pero no se han comparado manualmente todos los 900 huecos con las páginas impresas originales. Las preguntas son literales *respecto de nuestra transcripción maestra*.

## Progreso y código

Se conserva la clave de progreso `adaptive_b2_cloze_campaign1_v1`, el identificador de campaña y todo el historial anterior. Las tarjetas fuera del banco activo quedan retiradas del muestreo sin borrarlas del historial. Se mantiene el flujo tradicional de la app, sin otra aplicación ni un nuevo modo que sustituya al quiz.

Compilación: ejecutar `node generate-exam-quiz.cjs` teniendo el repositorio `adaptive-exam` como hermano de la carpeta del proyecto; produce `territory-01.json`, `territory-01.js` y `exam-quiz-source-qa.json`. La fuente adicional de Cambridge Part 4 se conserva en `cambridge-part4-source.json`. La compilación es reproducible sin IA en ejecución. Validar con `node test-exam-quiz.cjs` y comprobación funcional de navegador antes de publicar.

## Cierre Bloque 1 · colaboración Gemini / ChatGPT (21/10/2026) · v1.12.1

Mejoras concretas, sin tocar el historial ni las Parts 1–3:
- Part 4 usa el diseño compacto responsivo, palabra obligatoria destacada con un span DOM seguro (`qe-keyword-badge`), y reserva la altura real necesaria, sin recortar texto.
- Se compensa la barra `.adrian-tools` por encima de `.app` al mostrar Part 4; `.app` ya no obliga a un segundo `100dvh`. En alturas reducidas se usan botones táctiles de al menos 44 px y texto >=17 px.
- Exam 20 / Part 4 / Q28 (`LONG`, ID 962028): clave canónica `spent a long time`; formas admitidas `spent/took/was a long time` según el solucionario Cambridge revisado por Gemini; distractores `passed a long time`, `lasted a long time` y `spent long time`. Las soluciones alternativas se mantienen en `acceptedForms`, no aparecen como distractores.
- Los tres distractores del ítem y las formas admitidas se mantienen en `curated-part4-overrides.json`. El generador `generate-exam-quiz.cjs` aplica esa fuente local antes de validar y escribir, sin interceptar funciones de escritura del sistema.
- El guard de `missing-word` evita eliminar verbos iniciales o sustantivos finales. Los otros 155 grupos automáticos de Part 4 **siguen pendientes de auditoría semántica individual**.

Verificación: `node generate-exam-quiz.cjs`, `node test-exam-quiz.cjs` y `node test-part4-geometry.cjs`. El último lanza Python Playwright/Edge, carga los activos locales en el origen de GitHub Pages (requiere red), comprueba los 180 ítems de Part 4 a 360×740, 412×780, 412×915 y 390×650; prueba la legibilidad, ausencia de recortes, scroll, posición de temporizador/EXIT y un control básico de Parts 1–3. No reemplaza la comprobación manual en el Pixel. La transcripción de los 900 huecos frente a cada PDF sigue pendiente.

## 22/10/2026 · v1.12.2 · tiempo variable solo en English Cloze

- La aplicación sigue teniendo 900 preguntas de los 30 exámenes y sesiones de 15. Cambia **solo el presupuesto temporal de cada pregunta**; los otros juegos del Hub conservan sus temporizadores.
- El motor local `cloze-timing.js` calcula el límite antes de cada pregunta a partir de la parte B2 (1–4), las palabras del enunciado, las cuatro alternativas y el coste de comparar respuestas. Part 4 incluye dos frases y KEY WORD, por eso recibe más tiempo. Los límites iniciales son Part 1: **16–26 s**, Part 2: **17–28 s**, Part 3: **18–30 s**, Part 4: **26–42 s**. En el banco actual las medianas son respectivamente 20, 21, 22 y 30 s.
- La referencia Cambridge concede 75 minutos para las 52 preguntas de Reading and Use of English (7 partes): **no proporciona una duración normativa para cada ejercicio aislado de nuestro quiz**. Los valores anteriores son una hipótesis pedagógica conservadora y jugable, no cifras científicas exactas.
- El algoritmo aprende discretamente **solo tras 12 respuestas correctas registradas con este nuevo reloj y dentro de la misma parte**. Si el percentil 75 de su utilización es alto, añade entre 1 y 3 segundos, sin acortar nunca la duración básica. El historial anterior de 15 s se conserva, pero no calibra el reloj porque estaba truncado por el límite antiguo.
- El cronómetro superior, la barra inferior, las 20 píldoras visuales, el aviso sonoro de los últimos 12 segundos, el cálculo de velocidad y el historial utilizan el mismo límite. El modo **Leer primero** ofrece hasta 7,6 s para leer Part 4 antes de iniciar el cronómetro de respuestas y conserva el botón para mostrar las opciones inmediatamente.
- Nueva versión del registro de tiempo: `timerModelVersion:1`, `sourcePart`, `timeLimitSec` y `targetTimeSec`. Se mantiene exactamente `adaptive_b2_cloze_campaign1_v1` como clave de datos y no se incluyen datos personales en el código.
- Tests: `node test-cloze-timing.cjs`, `node test-exam-quiz.cjs`, `node test-part4-geometry.cjs`, `python test-cloze-timer-browser.py`, `python test-cloze-timer-readfirst.py`. Queda comprobar manualmente la experiencia con el Pixel y observar suficientes respuestas nuevas para evaluar la calibración personal.

## 22/10/2026 · v1.12.3 · Optimización del espacio móvil / PWA

**Motivo:** captura `109887.png` y vídeo `109886.mp4` del Pixel 10: Chrome muestra su barra de direcciones y el Hub añade una segunda barra de navegación con Atrás / Panel / Hub / A− / JSON. Se requiere recuperar altura sin tocar el motor de 900 ejercicios, el temporizador variable ni los datos.

**Solución localizada:**
- La PWA `manifest.webmanifest` ya tenía `display: standalone` y scope/id estables. Se mantiene el mismo origen y los identificadores de almacenamiento para conservar el progreso. Se añaden iconos PNG 192/512 para favorecer una instalación independiente en Android, tema oscuro y descripción actualizada. Si Chrome instala la PWA correctamente y se abre desde su icono, la barra de direcciones del navegador deja de mostrarse; esto **requiere comprobación física en el Pixel**, ya que las barras del sistema operativo permanecen según configuración.
- Barra compartida del Hub, sin alterar `/adrian-core`: `cloze-mobile-space.js/.css` introducen un botón **Menú** de 44 px en la pantalla inicial. Conserva las acciones originales; se despliegan bajo demanda y se cierran con Escape o un toque fuera. Durante una partida la barra desaparece completamente y `EXIT` continúa visible y operativo. En escritorio la navegación se mantiene sin cambios.
- Textos iniciales y reglas de misión: se elimina el rótulo obsoleto de 15 segundos y se explica el tiempo adaptado. La ayuda de LEER PRIMERO / TODO JUNTO reacciona correctamente al cambio de modo.
- Se corrige `refresh-exam-cache.cjs` para calcular el hash SHA-256 de los iconos PNG a partir de sus **bytes reales** y no mediante decodificación UTF-8. El resto de los activos mantiene el método habitual. Cache/integridad de la PWA sincronizados con la versión nueva.

**Verificación en Edge Playwright móvil, sin tocar los datos del usuario:** comparativa antes/después a 360×740, 412×780, 412×915 y 390×650. La barra inicial pasa de 69–88 px a 49 px (ganancia 20–39 px); durante el juego pasa de 69–82 px a 0 (ganancia 69–82 px). Verificados menú expandible (cinco controles originales visibles), navegación recuperable tras EXIT, ningún scroll horizontal, sin errores JS; test reproducible `python test-cloze-mobile-space.py`. `node test-part4-geometry.cjs` comprueba las 180 transformations × cuatro resoluciones (720 casos) sin desbordamiento. `node test-exam-quiz.cjs` y `node test-cloze-timing.cjs` preservan banco y tiempo variable.

**Límites:** no se puede ocultar la interfaz propia de Chrome desde CSS de un sitio web normal. La ganancia adicional de Chrome independiente debe probarse instalando/abriendo la PWA en el Pixel. No se modifica el marco lateral decorativo sin evidencia de que cause desbordamiento; `scrollWidth-innerWidth` es cero en las pruebas. Las otras aplicaciones del Hub se conservan intactas.

## 22/10/2026 · v1.12.4 · revisión de vídeo Pixel 10 (109961.mp4)

**Fuente de observación:** vídeo del Pixel 10 de 127,9 s grabado tras instalar/abrir la v1.12.3. En 00:00–01:05 se ve inicio sin barra de direcciones de Chrome (compatible con modo PWA standalone), menú compacto abierto y siete accesos reales (Cerrar, Atrás, Panel, Hub, acceso alternativo a Hub, A− y JSON): el botón JSON caía solo en una fila adicional. En 01:05–02:08, los ejercicios de Parts 1–4 y el tiempo adaptado funcionan; cerca de 01:50–02:00, durante KEY WORD FACT, queda una gran zona oscura bajo EXIT, ausente en Parts 1–3. La pantalla en negro momentánea durante un cambio de pregunta corresponde a la transición temporal ya existente y no se modifica.

**Dos correcciones específicas, sin cambios en datos ni en el motor del quiz:**
- `cloze-mobile-space.css`: menú abierto en rejilla de cuatro columnas y dos filas, con botones táctiles de 44 px y los mismos enlaces/eventos existentes. En cuatro resoluciones móviles, altura abierta **107 px**, frente a **139–163 px** anteriormente (32–56 px de mejora) y sin un botón JSON aislado.
- El mismo CSS pinta el **fondo del documento** del color claro de #gameScreen durante Part 4, pero solo mientras la pantalla de juego está activa. Part 4 mantiene la altura compacta para evitar scroll; no se estiran las tarjetas ni se reduce el tamaño del texto. Se corrige así la franja oscura bajo EXIT sin regresiones en Parts 1–3. Tras salir, el fondo original se restaura.

**Prueba reproducible:** `python test-cloze-video-109961.py` (requiere Playwright, Edge y Pillow). Comprueba 360×740, 412×780, 412×915 y 390×650, menú 4+3 de siete accesos, altura de 107 px, botones ≥44 px, Part 4 con cuatro respuestas y KEY WORD, temporizador variable, EXIT visible, fondo real de la captura #EEF2F6 hasta abajo, 0 desbordamiento y restauración del menú/fondo al salir. El test espera a que termine la introducción de misión para no confundirla con la pantalla de juego. Se complementa con `node test-part4-geometry.cjs` (180 Part 4 × 4 viewports), `node test-exam-quiz.cjs` y `node test-cloze-timing.cjs`.

**Sin modificar:** 900 preguntas y claves, 30 exámenes, historial local, temporizador variable y calibración, interfaz de lectura, instalación PWA e iconos, recursos /adrian-core compartidos y demás apps. Probar manualmente la nueva versión con el Pixel sigue siendo recomendable; una grabación previa demuestra el síntoma pero no constituye prueba de la corrección nueva en hardware Android.
