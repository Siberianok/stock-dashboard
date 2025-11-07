# Guía manual de verificación de accesibilidad

Este checklist cubre los flujos críticos identificados en la auditoría de componentes. Ejecutalo cada vez que modifiques el layout o la interacción de los elementos listados.

## Preparación

1. Levantá el entorno local con `npm install` y `npm run dev`.
2. Abrí `http://localhost:5173/` en un navegador con soporte para lector de pantalla (NVDA/JAWS/VoiceOver) y asegúrate de tener habilitados atajos globales.
3. Activá el lector de pantalla y dejalo en modo exploración o lectura según corresponda.

## Tabla de tickers

1. Navegá con `Tab` hasta que una fila de la tabla quede enfocada.
2. Usá flechas y `Tab` para recorrer celdas y controles embebidos (inputs, selectores, checkboxes).
3. Presioná `Enter` o `Espacio` sobre la fila enfocada y confirmá que se marque como seleccionada (anuncio del lector y resaltado visual).
4. Actuá sobre cada `Badge` con el lector: verificá que el nombre del criterio se anuncie seguido de "criterio cumplido" o "criterio no cumplido".
5. Cambiá el `select` de mercado y asegurate de que el lector describa la etiqueta "Mercado" y el valor actual.

## Tooltips (Score, Sankey, Radar)

1. Colocá el foco sobre cada visualización con `Tab` (botones de exportación) y luego con el mouse o teclado (`Shift+F10` según navegador) hacé aparecer los tooltips.
2. Confirmá que los textos muestren traducciones consistentes en español ("Cantidad de tickers", "Participación en el período", "Origen", "Destino", etc.).
3. Si el lector soporta anuncios de tooltips, validá que el contenido se lea de forma comprensible y ordenada.

## Diálogo de vista previa

1. Con el foco en la tabla, presioná `Ctrl+P` para abrir la vista previa.
2. Verificá que el lector anuncie el título del diálogo y que el foco inicial quede en el contenedor.
3. Recorre los botones del pie (`Cerrar`, `Descartar borrador`, `Aplicar cambios`) con `Tab` y comprobá que sean alcanzables y que `Esc` cierre el diálogo.

## Panel de diagnósticos

1. Forzá una carga de datos (ejemplo: botón **Refrescar precios** o habilitá modo demo) y esperá a que aparezca el botón **Mostrar panel de diagnósticos**.
2. Activá el botón y revisá que se anuncie el cambio de estado (`aria-expanded`).
3. Dentro del panel, confirmá que las listas de métricas y errores se leen completas y que las actualizaciones se anuncian sin solapar la lectura actual (usar modo foco del lector para comprobarlo).
4. Ocultá el panel y asegurate de que el foco permanezca en el botón que controla su visibilidad.

## Registro

Documentá cualquier regresión o comportamiento inesperado en la issue correspondiente, adjuntando:
- Descripción del lector de pantalla usado y versión.
- Pasos exactos para reproducir.
- Capturas de pantalla o grabaciones si están disponibles.
