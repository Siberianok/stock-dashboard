# Inventario de pruebas pendientes

Este inventario se centra en los componentes de `src/components` y en los hooks clave de `src/hooks` para visibilizar las piezas sin cobertura actual y priorizar la creación de pruebas de acuerdo con el impacto en la experiencia del usuario y la complejidad técnica.

## Componentes de `src/components`

| Archivo | Rol principal | Cobertura actual | Prioridad | Justificación |
| --- | --- | --- | --- | --- |
| `components/TickerTable.jsx` | Tabla interactiva para revisar, editar y puntuar tickers, con paginación, accesibilidad y múltiples acciones (exportar, ordenar, limpiar). | Sin pruebas de renderizado ni de comportamiento. | Alta | Es el núcleo operativo del dashboard y concentra lógica de interacción compleja (teclado, selección, paginación y cálculos de score). Un fallo aquí impacta directamente en el flujo principal. |
| `components/filters/FiltersPanel.jsx` | Panel para ajustar umbrales del escáner (mercados, precios, liquidez, flags). | Sin pruebas. | Alta | Controla reglas de filtrado críticas. Validar bindings y errores evita regresiones al editar thresholds. |
| `components/PreviewDialog.jsx` | Modal accesible para inspeccionar un ticker específico. | Sin pruebas. | Alta | Combina gestión de foco, cierre por teclado/click y representación de datos; errores afectan accesibilidad y la revisión de candidatos. |
| `components/HistoricalComparisonCard.jsx` | Tarjeta con gráfico y tabla comparativa contra benchmarks históricos. | Sin pruebas. | Media | Presenta lógica de formateo y exportación, pero el impacto es secundario frente a la tabla principal; requiere validación de estados (cargando, error, sin datos). |
| `components/DiagnosticsPanel.jsx` | Panel de diagnóstico con logs y suscripción a métricas. | Sin pruebas. | Media | Útil para observabilidad y debugging; validar subscripciones evita fugas y ruido en producción. |
| `components/ScoreBar.jsx` | Indicador visual del score con gradientes y etiquetas. | Sin pruebas. | Media | Se reutiliza en múltiples vistas; pruebas asegurarían accesibilidad y rangos pero la lógica es acotada. |
| `components/Badge.jsx` | Chip visual para flags de filtros. | Sin pruebas. | Baja | Componente de presentación sin lógica; validar estilo queda en segundo plano. |

## Hooks en `src/hooks`

| Hook | Cobertura actual | Prioridad | Justificación |
| --- | --- | --- | --- |
| `useScanner` | Solo se ejercita la función auxiliar `scanUniverse` mediante pruebas unitarias. | Alta | El hook maneja ciclos de vida, abortos, estados de carga y cobertura; pruebas con `@testing-library/react` detectarían regresiones en la UI conectada. |
| `useThresholds` | Lógica de estado cubierta indirectamente por pruebas de utilidades (`thresholds.test.js`, `thresholdDrafts.test.js`), pero el hook en sí no se monta. | Alta | Maneja sincronización con storage, historial y presets. Probar el hook completo validaría side-effects (persistencia, normalización). |
| `useDashboardMetrics` | No hay pruebas. | Media | Orquesta snapshots, filtros por rango y agregaciones; clave para tarjetas de métricas y gráficos. |
| `useHistoricalBenchmarks` | No hay pruebas del hook; existen tests para servicios utilitarios relacionados. | Media | Gestiona estados asincrónicos y deduplicación; pruebas deben asegurar re-render controlado ante cambios de `thresholds` y `timeRange`. |
| `useChartExport` | Sin pruebas. | Baja | Depende fuertemente del DOM y APIs de navegador; se puede cubrir con pruebas de integración pero su impacto es menor. |
| `useTheme` | Sin pruebas. | Baja | Maneja preferencias y localStorage. Validar toggles sería útil pero su criticidad es baja frente a la lógica del escáner. |

## Próximos pasos sugeridos

1. Priorizar suites para `TickerTable`, `FiltersPanel`, `PreviewDialog` y los hooks `useScanner`/`useThresholds`, aprovechando `@testing-library/react` para montar componentes reales.
2. Complementar con pruebas de estados en `HistoricalComparisonCard` y `DiagnosticsPanel` una vez cubierta la capa crítica.
3. Programar sesiones específicas para hooks secundarios (`useDashboardMetrics`, `useHistoricalBenchmarks`, `useTheme`, `useChartExport`) enfocadas en efectos secundarios y persistencia.

Este documento debe actualizarse conforme se agreguen suites nuevas para mantener la trazabilidad del esfuerzo de pruebas.
