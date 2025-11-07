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
- El workflow instala dependencias (`npm ci`), corre los tests (`npm test`), compila la `dist/` con Vite (`npm run build`) y publica el artefacto con `actions/deploy-pages`.
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

## Checklist de verificación rápida

Antes de publicar una nueva versión revisá:

- `npm test` para asegurarte de que la lógica de cálculo y el modo simulado siguen funcionando.
- `npm run build` para verificar que Vite genere `dist/` sin errores.
- En el dashboard, probá **Activar modo simulado** si Yahoo Finance devuelve errores o límites: siempre deberías ver datos demo.
- Confirmá en la consola del navegador que las peticiones a `https://query1.finance.yahoo.com/v7/finance/quote` devuelven 200 o, en caso contrario, que el modo simulado se activa.
- En GitHub Pages, revisá que no haya 404 en los assets: el `base` de Vite (`/stock-dashboard/`) debe coincidir con la URL publicada.

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
