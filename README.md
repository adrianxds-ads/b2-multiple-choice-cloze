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
