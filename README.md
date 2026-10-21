# English Cloze · B2 First

## Modo principal: exámenes originales (21/10/2026)

La portada principal abre **Exámenes originales**. Se seleccionan preguntas exclusivamente de los **30 exámenes** del banco maestro de Cambridge B2: 10 Cambridge y 20 EngExam, con 8 huecos en cada una de las Parts 1, 2 y 3 por examen (**720 huecos / 90 partes**). Se muestran los textos originales transcritos del banco, conservando su redacción y todas las opciones de la Part 1 sin crear distractores.

- Part 1: cuatro opciones originales en su orden original.
- Part 2: campo de texto, una palabra; acepta variantes ya registradas en el banco.
- Part 3: campo de texto con la palabra base original; acepta variantes ya registradas.
- 15 preguntas por sesión, seleccionadas de 15 partes distintas; lectura libre y 15 segundos para contestar.
- Correcciones de las fuentes ya almacenadas: Cambridge 01–10 (clave registrada) o EngExam 11–30 (material original, **no** clave oficial Cambridge). Todos los 720 huecos disponen de respuesta en la transcripción; no se fabrican respuestas automáticamente ni se presentan inferencias como oficiales.
- Si faltan fuentes o hay estructura incompleta, la carga se bloquea en lugar de mostrar preguntas inventadas.
- Nuevo progreso independiente en `cloze_original_papers_v1`. El progreso histórico `adaptive_b2_cloze_campaign1_v1` no se borra ni migra.

### Fuente literal y límite de verificación
Esta edición lee los datos de las fuentes publicadas del proyecto hermano `adaptive-exam` (`data/cambridge-quiz-transcribed.js` y `data/engexam-bank.js`), obtenidas de nuestros exámenes transcritos. El software no transforma ni parafrasea los enunciados originales guardados. **La coincidencia carácter por carácter de las 90 partes con cada página PDF impresa aún no se ha revalidado individualmente en esta entrega**. Una fuente externa no accesible impide iniciar la sesión: actualmente el modo literal requiere conexión para esas dos bibliotecas.

### Repaso anterior preservado
El banco anterior (2.431 tarjetas de opción múltiple, incluidas 1.610 de la app clásica y 821 derivadas de las Parts 2–3) no se elimina. Sigue accesible desde el desplegable «Repaso anterior» de la portada o el enlace «Repaso anterior» de la nueva pantalla. Se conserva su motor, historial, estadísticas y clave de almacenamiento.

### Generación y comprobación
Verificar `node --check literal-exams.js` y abrir `literal-exams.html` en navegador con acceso a los scripts del proyecto `adaptive-exam`. Validación de banco: 30 exámenes, 90 partes, 720 preguntas distintas, cero faltantes, opciones originales de Part 1 y palabra base de Part 3. Comprobar respuestas de las tres partes, almacenamiento independiente, salida y reanudación. La manifestación de caché se actualiza en cada publicación con los hashes de archivos modificados.
