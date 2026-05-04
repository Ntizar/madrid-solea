# SolMAD

> La pregunta mas importante de Madrid, despues de "quien ha dejado esto en doble fila":
>
> **En que terraza me puedo tomar una caña ahora mismo y que me de el sol?**

SolMAD cruza el censo oficial de terrazas de Madrid con la posicion del sol y las sombras aproximadas de edificios de OpenStreetMap. El resultado es un mapa para encontrar ese sitio exacto donde pedir una caña, ponerse dramaticamente de cara al astro rey y fingir que la vida esta bajo control.

https://solmad.vercel.app

---

## Que hace

- Muestra mas de **6.200 terrazas abiertas** del Ayuntamiento de Madrid.
- Calcula si una terraza tiene **sol directo ahora mismo**.
- Estima cuanto sol le queda durante el dia.
- Permite cambiar la hora con slider, presets y botones rapidos de `-15` / `+15`.
- Distingue terrazas con sol, sombra y noche.
- Abre una ficha con horario, mesas, sillas, superficie y ruta en Google Maps.
- Tiene boton **Sorpresa** para dejar que el destino hostelero decida.
- Pide ubicacion para encontrar opciones cerca de ti.
- Usa mapas libres sin tokens ni autenticacion.

Si alguna sombra se equivoca por un toldo, un arbol o una fachada con ganas de protagonismo: calma. Es una primera version presentable, no una tesis doctoral con sombrilla homologada.

---

## Stack

- **Vite + React + TypeScript**
- **Leaflet** para el mapa
- **Leaflet.markercluster** para que 6.200 terrazas no conviertan Madrid en una sopa de puntitos
- **CARTO Voyager / CARTO Light / OSM / HOT** como tiles libres sin login
- **SunCalc** para la posicion solar
- **Web Workers + Comlink** para calculos de sombras sin bloquear la UI
- **Three.js** para la intro cinematografica
- **Zustand** para estado global
- **Tailwind** para la interfaz

---

## Como correrlo

Requisitos: Node 18+.

```bash
npm install
npm run dev
```

Build de produccion:

```bash
npm run build
```

Para que el formulario de aportes guarde precio, marca y nombre en GitHub desde Vercel, define estas variables de entorno en el proyecto:

```text
SOLMAD_GITHUB_TOKEN=token_con_permiso_contents_write
GITHUB_OWNER=Ntizar
GITHUB_REPO=solmad
GITHUB_BRANCH=main
CONTRIBUTIONS_PATH=data/contributions.json
SUN_CACHE_PATH=data/sun-cache.json
```

`SOLMAD_GITHUB_TOKEN` debe ser un secreto de Vercel, nunca codigo cliente. Los endpoints `/api/contribute` y `/api/sun-cache` lo usan para escribir en GitHub mediante la API oficial.

Para sacarlo: GitHub → Settings → Developer settings → Personal access tokens → Fine-grained token. Dale acceso solo al repo `Ntizar/solmad` y permiso **Contents: Read and write**. Despues pegalo en Vercel como `SOLMAD_GITHUB_TOKEN` en Production, Preview y Development si quieres probarlo todo.

El script `prepare:data` se ejecuta antes de `dev` y `build`. Lee el JSON bruto del Ayuntamiento, limpia strings, filtra locales abiertos, reproyecta coordenadas `EPSG:25830 -> WGS84` y genera:

```text
public/terrazas.min.json
```

---

## Como calcula el sol

1. Carga las terrazas oficiales de Madrid.
2. Descarga footprints de edificios desde Overpass/OpenStreetMap y los cachea en `localStorage`.
3. Estima alturas con `height`, `building:levels * 3.2 m` o fallback de `17 m`.
4. Indexa segmentos de fachadas en un grid dentro de un Web Worker.
5. Para cada terraza traza un rayo hacia el sol y comprueba si algun edificio lo tapa.
6. Repite en pasos de tiempo para estimar minutos restantes y ritmo solar del dia.

Traduccion humana: intenta responder si vas a estar al solecito o en modo bufanda interior.

---

## Estado actual

- Listo para una primera presentacion.
- Mapa estable con Leaflet y tiles sin autenticacion.
- Hora visible sobre el mapa con cambios rapidos de `-15` y `+15` minutos.
- Calculo de sombras aproximado, suficientemente majo para decidir donde sentarse.
- Pendiente para futuras versiones: arbolado, toldos, sombrillas reales, terrazas favoritas, PWA y modo "necesito vitamina D ya".

---

## Datos y creditos

- Terrazas: [Portal de datos abiertos del Ayuntamiento de Madrid](https://datos.madrid.es/) (CC BY 4.0).
- Edificios: OpenStreetMap contributors (ODbL).
- Tiles: CARTO / OpenStreetMap / HOT.
- Calculo solar: [SunCalc](https://github.com/mourner/suncalc).

Hecho con sol, ganas y algo de cafe por **David Antizar** para los disfrutones de Madrid.
