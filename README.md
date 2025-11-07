# Selector de Acciones – Parabólicas

Dashboard visual (checklist + scoring + gráficos) para filtrar candidatas momentum/parabólicas.

## Live (GitHub Pages)
Este repo usa **GitHub Pages**. Hay dos formas de publicar:
- **Con GitHub Actions (recomendado aquí):** cada `push` a `main` despliega automático.
- **Deploy from a branch (simple):** seleccionar `gh-pages` (o la rama que definas) y apuntar al contenido compilado.

Pasos mínimos para un deploy manual:

1. Ejecutar `npm run build` para generar la carpeta `dist/`.
2. Subir el contenido de `dist/` a la rama configurada en Pages.
3. Confirmar que la URL final respete el `base` configurado en `vite.config.js` (`/stock-dashboard/`).

### Deploy automático (recomendado)
- Cada `push` a `main` ejecuta el workflow [`Deploy dashboard to GitHub Pages`](.github/workflows/deploy.yml).
- El workflow instala dependencias, corre los tests y compila la `dist/` con Vite.
- El artefacto compilado se publica en la rama interna de Pages mediante `actions/deploy-pages`.
- Asegurate de tener activado GitHub Pages en **Settings → Pages** con `Source: GitHub Actions`.

### Deploy manual (fallback)
Si querés un deploy manual:

1. Ejecutá `npm run build` para generar la carpeta `dist/`.
2. Subí el contenido de `dist/` a la rama configurada en Pages (por ejemplo `gh-pages` o `docs/`).
3. Confirmá que la URL final respete el `base` configurado en `vite.config.js` (`/stock-dashboard/`).

URL esperada: `https://<usuario>.github.io/<repo>/`

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
