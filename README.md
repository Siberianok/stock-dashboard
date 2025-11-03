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

URL: `https://<usuario>.github.io/<repo>/`

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
