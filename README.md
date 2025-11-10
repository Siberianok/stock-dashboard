# Selector de Acciones – Parabólicas

Dashboard visual (checklist + scoring + gráficos) para filtrar candidatas momentum/parabólicas.

## Entorno productivo

- **URL principal:** [`https://<usuario>.github.io/stock-dashboard/`](https://<usuario>.github.io/stock-dashboard/)
- **Workflow de despliegue:** [`Deploy dashboard to GitHub Pages`](.github/workflows/deploy.yml)
- **Monitorización:** [`Pages health check`](.github/workflows/pages-healthcheck.yml) (ejecución horaria con `curl --fail`).

> Reemplazá `<usuario>` por la organización o usuario dueño del repositorio una vez configurado GitHub Pages.

## Configuración de GitHub Pages

1. Abrí **Settings → Pages** y definí `Source: GitHub Actions` para que los despliegues provengan del workflow.
2. Confirmá que exista el entorno `github-pages` y que `main` esté autorizado como rama de despliegue.
3. Opcional: agregá reviewers, secretos o variables necesarias en el entorno para integraciones externas.
4. Revisá la pestaña **Deployments** tras cada ejecución para validar la URL final que entrega `actions/deploy-pages`.

La configuración completa (incluyendo fallback manual y rollback) está detallada en [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Deploy automático (recomendado)

- Cada `push` a `main` ejecuta el workflow [`Deploy dashboard to GitHub Pages`](.github/workflows/deploy.yml).
- El workflow instala dependencias (`npm ci`), compila la `dist/` con Vite (`npm run build`) y publica el artefacto con `actions/deploy-pages`.
- Las pruebas continúan en el workflow [`CI`](.github/workflows/ci.yml), que corre lint, tests y valida el build sin bloquear el despliegue.
- Al finalizar, el job `deploy` asocia el resultado al entorno `github-pages` para facilitar aprobaciones y seguimiento.

## Deploy manual y rollback

### Fallback manual rápido

1. Ejecutá `npm ci` y `npm run build` localmente.
2. Copiá el contenido de `dist/` a una rama publicada (por ejemplo `gh-pages`).
3. En **Settings → Pages**, cambiá `Source` a `Deploy from a branch` y elegí la rama/carpeta correcta.
4. Validá la URL pública y, cuando termine la contingencia, regresá a `Source: GitHub Actions`.

### Procedimiento de rollback

1. Identificá el commit estable (en `git log` o desde **Deployments → History**).
2. Ejecutá `git revert <commit>` o creá una rama `rollback/<fecha>` basada en ese commit.
3. Abrí un pull request hacia `main` y esperá a que el workflow de deploy publique la versión revertida.
4. Como alternativa inmediata, generá `dist/` desde el commit estable y desplegalo usando el fallback manual.

## Monitorización y alertas

- El workflow [`Pages health check`](.github/workflows/pages-healthcheck.yml) se ejecuta cada hora y falla si `curl` no obtiene respuesta 2xx/3xx.
- Los fallos del health check o del deploy quedan registrados en Actions, lo que habilita notificaciones de GitHub (email/web) según tu configuración.
- Podés suscribirte a la vista **Actions → Notifications** para recibir alertas en caso de problemas.

## Desarrollo local

Instalá dependencias y levantá el entorno de desarrollo:

```bash
npm install
npm run dev
```

El build de producción se genera con:

```bash
npm run build
```

## Gestión de umbrales (thresholds)

- **Reset completo:** ejecutá `localStorage.removeItem('selector.thresholds')` en la consola del navegador o llamá a
  `persistThresholdState({ thresholds: DEFAULT_THRESHOLDS, history: [] })` desde un script. Ambos caminos generan un estado
  limpio que repuebla la aplicación con los valores de `DEFAULT_THRESHOLDS` y reinicia el borrador.
- **Mapeo de validaciones:** cualquier campo editable del formulario está descrito en
  `THRESHOLD_FIELD_VALIDATIONS` (`src/validation/filterRules.js`). Esta estructura documenta tipo, límites y reglas cruzadas
  y debe actualizarse al agregar nuevos inputs.
- **Agregar una migración:** incrementá `CURRENT_VERSION` en `thresholdStorage.js`, agregá una función `migrateToV<N>` que
  normalice los datos antiguos y encadenala dentro de `applyMigrations`. Acompañá el cambio con un test en `tests/` que cargue
  un payload de la versión anterior y confirme que `loadThresholdState()` entrega el nuevo formato.
- **Verificación rápida:** luego de ajustar reglas o migraciones, corré `npm test`. Los casos en
  `tests/filterRules.test.js` y `tests/thresholdDrafts.test.js` cubren los flujos de edición, presets, undo y almacenamiento
  persistente.

## Checklist de verificación rápida

Antes de publicar una nueva versión revisá:

- `npm test` para asegurarte de que la lógica de cálculo y el modo simulado siguen funcionando.
- `npm run build` para verificar que Vite genere `dist/` sin errores.
- En el dashboard, probá **Activar modo simulado** si Yahoo Finance devuelve errores o límites: siempre deberías ver datos demo.
- Confirmá en la consola del navegador que las peticiones a `https://query1.finance.yahoo.com/v7/finance/quote` devuelven 200 o, en caso contrario, que el modo simulado se activa.
- En GitHub Pages, revisá que no haya 404 en los assets: el `base` de Vite (`/stock-dashboard/`) debe coincidir con la URL publicada.

## Panel de diagnósticos

El dashboard incluye un panel colapsable de diagnósticos que concentra la telemetría del fetcher y los mensajes de error importantes.

1. Usá el botón **Mostrar panel de diagnósticos** (aparece apenas haya datos de telemetría) para desplegarlo. El mismo botón permite ocultarlo y expone el estado expandido mediante `aria-expanded` para lectores de pantalla.
2. La columna **Métricas recientes** lista las últimas 5 consultas ejecutadas, indicando:
   - Identificador de la petición (por ejemplo `quotes.live`).
   - Cantidad de símbolos recuperados vs solicitados.
   - Latencia total (`durationMs`).
   - Tamaño de la respuesta (`payloadSize`).
   - Resultado (`OK` cuando la API respondió correctamente, `Atención` cuando hubo reintentos o errores).
3. La columna **Errores recientes** muestra los últimos 5 eventos críticos registrados por el logger. Cada entrada especifica el contexto (`context`), el mensaje human readable y, si aplica, el listado de símbolos afectado. La marca de tiempo usa hora local con precisión a segundos.

Este panel funciona como guía rápida para interpretar problemas de conectividad (payloads vacíos, respuestas lentas) y validar que los reintentos automáticos se están ejecutando. Al estar integrado en el flujo principal y anunciar actualizaciones mediante regiones vivas (`aria-live`), se puede seguir la salud del fetch sin abandonar el dashboard.

## Estructura

```
.
├── src/
│   ├── components/        # UI reutilizable (tablas, badges, visualizaciones)
│   ├── hooks/             # Lógica de estado y presets de thresholds
│   ├── services/          # Integraciones externas (Yahoo Finance)
│   ├── utils/             # Helpers de formato, cálculos y constantes
│   └── App.jsx            # Layout principal del dashboard
├── tests/                 # Pruebas con node:test
├── index.html             # Entry point de Vite
└── vite.config.js         # Configuración del bundler
```
