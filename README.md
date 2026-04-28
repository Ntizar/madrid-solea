# Madrid Solea

Web app para responder: "¿En qué terraza de Madrid me puedo tomar una caña ahora mismo y darme el sol?"

## Arranque local

```bash
npm install
npm run dev
```

## Datos

El proyecto necesita el censo oficial de terrazas del Ayuntamiento de Madrid.

Opciones válidas:

- `data/terrazas.json` dentro del repo
- `../209548-796-censo-locales-historico.json` si estás trabajando desde un workspace externo que envuelve esta carpeta

En el build se ejecuta `npm run prepare:data`, que:

- hace `trim()` de strings
- filtra `desc_situacion_local === "Abierto"`
- reproyecta `EPSG:25830` a `WGS84`
- genera `public/terrazas.min.json`

## Deploy

- GitHub Pages: workflow en `.github/workflows/deploy-pages.yml`
- Vercel: despliegue estático de Vite, sin configuración extra

## Notas

- Las sombras usan footprints de OpenStreetMap y altura por `height`, `building:levels` o fallback de `17 m`.
- El cálculo corre en Web Worker con Comlink.
- `vite.config.ts` usa `base: './'` para que funcione correctamente en GitHub Pages.