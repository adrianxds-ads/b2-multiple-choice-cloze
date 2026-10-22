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
