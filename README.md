# Stock Dashboard

Aplicación web para explorar y puntuar acciones con métricas clave, gráficos interactivos y flujos de revisión. Permite cargar cotizaciones en vivo mediante Yahoo Finance y alterna automáticamente a datos simulados cuando la fuente real no está disponible.

## Características
- Tabla editable de tickers con campos de precios, volumen, float, corto, ATR y medias exponenciales.
- Paneles de diagnóstico, distribución de puntuaciones, radar de rendimiento y diagrama Sankey de flujos.
- Filtros y previsualización de cambios, con exportación de métricas y gráficos.
- Persistencia local de filas y preferencias, más modo de datos simulados automático cuando falla la detección de la fuente remota.

## Requisitos
- Node.js 20.x
- npm 10.x o superior (incluido con Node 20)

## Instalación
```bash
npm install
```

## Scripts disponibles
- `npm run dev`: inicia el servidor de desarrollo de Vite.
- `npm run build`: genera la build de producción.
- `npm run preview`: sirve la build resultante para revisión local.
- `npm run test`: ejecuta la suite de pruebas con Vitest.
- `npm run test:watch`: corre las pruebas en modo observador.
- `npm run test:coverage`: produce el reporte de cobertura.
- `npm run lint`: ejecuta ESLint sobre el código.
- `npm run format`: verifica el formato con Prettier.

## Estructura del proyecto
- `src/`: código fuente principal.
  - `components/`: tabla de tickers, paneles de diagnóstico y tarjetas de visualización.
  - `services/`: detección de fuente de datos, consumo de Yahoo Finance y datos simulados.
  - `hooks/`: lógica de negocio compartida (umbral de alertas, escáner, métricas y tema).
  - `utils/`: constantes, formatos, cálculos y utilidades para formularios y métricas.
  - `styles.css`: estilos globales.
- `vite.config.js`: configuración de Vite con React.

## Desarrollo
1. Ejecuta `npm run dev` y abre la URL indicada por Vite.
2. Para asegurar calidad antes de publicar, pasa `npm run lint` y `npm run test`.

## Despliegue en GitHub Pages
1. En Settings → Pages, en la sección **Build and deployment**, selecciona **GitHub Actions** para que Pages use el flujo automático.
2. Los pushes a `main` disparan `.github/workflows/deploy.yml`, que ejecuta `npm ci`, corre `npm run build` y publica `dist/` usando `actions/upload-pages-artifact` + `actions/deploy-pages`.
3. La acción crea y actualiza automáticamente el entorno `github-pages` (no se necesita configurar una rama `gh-pages`). Si ya usabas `gh-pages`, cambia la opción de Pages a GitHub Actions para que tome el nuevo flujo.
4. La URL pública debería seguir el formato `https://<usuario>.github.io/stock-dashboard/`; el `base` definido en `vite.config.js` (`/stock-dashboard/`) asegura que los assets carguen desde esa ruta.
5. Si ves recursos cacheados después de desplegar, fuerza recarga del navegador o usa **Purge cache** en el panel de Pages.

## Notas sobre datos
La aplicación intenta usar Yahoo Finance para obtener cotizaciones; si la solicitud falla o expira, cae a un modo simulado y muestra el aviso "Fuente real caída, estás viendo datos simulados". Esto permite seguir explorando el flujo de análisis aun sin conexión estable.
