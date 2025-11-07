# Despliegue y operaciones de GitHub Pages

## Configuración del entorno `github-pages`

1. Abrí **Settings → Pages** en el repositorio.
2. En **Build and deployment**, seleccioná `Source: GitHub Actions`.
3. Guardá la configuración para que GitHub cree el entorno `github-pages`.
4. En **Environments**, confirmá que exista `github-pages` y que `main` esté autorizado para desplegar.
5. Opcional: agregá las URLs de producción y los reviewers requeridos si necesitás aprobaciones manuales.

> ⚠️ Los deployments de GitHub Actions usan la rama interna de Pages; no necesitas administrar `gh-pages` manualmente salvo en un rollback de emergencia.

## Flujo automático (recomendado)

El workflow [`Deploy dashboard to GitHub Pages`](../.github/workflows/deploy.yml) se dispara en cada push a `main` y publica el artefacto compilado cuando los tests (`npm test`) y la compilación (`npm run build`) finalizan sin errores. El resultado queda visible en la URL configurada en Pages.

## Deploy manual de respaldo

Si GitHub Actions no está disponible o necesitás un despliegue manual controlado:

1. Ejecutá `npm ci` y `npm run build` en tu máquina local. El resultado queda en `dist/`.
2. Creá una rama dedicada (por ejemplo `gh-pages`) y copiá el contenido de `dist/` al root de esa rama.
3. Publicá la rama manualmente (`git push origin gh-pages`).
4. En **Settings → Pages**, cambiá temporalmente `Source` a `Deploy from a branch` y elegí `gh-pages` con la carpeta `/`.
5. Verificá que la URL pública cargue sin errores y, cuando restaures el flujo automatizado, volvé a `Source: GitHub Actions`.

## Procedimiento de rollback

Para restaurar una versión estable:

1. Identificá el commit que querés restaurar (por ejemplo con `git log` o inspeccionando deployments anteriores en la pestaña **Deployments** del entorno `github-pages`).
2. Ejecutá `git revert <commit>` o creá una rama `rollback/<fecha>` basada en ese commit.
3. Subí los cambios y forzá el despliegue automático (`git push origin rollback/<fecha>` y luego abrí un pull request hacia `main`).
4. Una vez fusionado, el workflow de deploy publicará la versión revertida. Confirmá la publicación en la pestaña **Deployments**.
5. Si necesitás un rollback inmediato sin esperar al workflow, usá el procedimiento de deploy manual con el artefacto `dist/` generado desde el commit estable.

