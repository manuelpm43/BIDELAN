# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

BIDELAN is a static web viewer (no build step, no package manager) for querying kilometer points (*puntos kilométricos*, PK) on roads. It's built on the **API-IDEE** web mapping library (Spanish national geoportal's OpenLayers-based API) and serves data from a **GeoServer** instance via WMS (map rendering) and WFS (feature queries).

There is no dev server, bundler, or test suite — this is plain HTML/CSS/JS opened directly or served statically. To work on it, open `index.html` in a browser (e.g. via a simple static file server) and use browser DevTools for debugging.

## Architecture

The app is a single page (`index.html`) split into five conceptual blocks, per `BIDELAN.md`:

- **Header** (`#logo`) — BIDELAN branding
- **Panel de capas** (`#sidebar`) — search box, layer tree (Geometría / Equipamiento / Edificaciones / Estructuras / Drenaje), campaigns (Campañas 2026-2028), result filtering, and analysis blocks. Most sub-blocks beyond "Geometría" and the search are placeholders ("Próximamente") for future versions.
- **Mapa** (`#mapa`) — the API-IDEE/OpenLayers map instance
- **Panel de información** — the draggable popup (`#overlayFichaPK`) showing attributes of a selected PK
- **Footer** — not yet implemented

### JS module responsibilities (`js/`, loaded in this order in `index.html`)

1. `panel.js` — defines `mostrarInfoPK()`, `mostrarFichaPK()`, `ocultarFichaPK()` and drag behavior for the PK detail popup. Loaded first because `app.js` calls `mostrarInfoPK`.
2. `app.js` — creates the API-IDEE map (`const mapa`), configures WMTS background layers (ortofoto/cartografía/híbrido), adds the `bidelan:pk_v0` WMS layer (`const capaPKv0`), auto-fits the map extent to the WFS data on load, and handles map click → WFS nearest-feature query → shows the popup via `mostrarInfoPK`.
3. `buscador.js` — loads all `bidelan:pk_v0` features via WFS once on startup into `datosPK`, then implements the sidebar search input: live filtering/suggestions and Enter-to-select, both matching against `"<CARRETERA> · PK <PK>"` (normalized, accent-insensitive).
4. `capas.js` — wires the `#checkPKv0` checkbox to toggle the underlying OpenLayers layer visibility via `cambiarVisibilidadCapa()`.

Key shared globals (declared with `const`/`let` at top level, relied on across files since there's no module system): `mapa`, `geoserverWfsUrl`, `capaPKv0`, `datosPK`.

### Data source

All feature data currently comes from one GeoServer instance and one layer:
- WMS/WFS base URL: `https://visor.geospatiallab.xyz/geoserver/bidelan/ows` (WFS) and `.../geoserver/bidelan/wms` (WMS) — nginx en el servidor (217.71.202.62) hace de proxy inverso HTTPS hacia GeoServer, que escucha internamente en el puerto 8080. El visor completo (mapa, login/registro, panel admin) vive en el subdominio `visor.geospatiallab.xyz`; la raíz `geospatiallab.xyz` es una página aparte, no forma parte de este proyecto.
- Layer: `bidelan:pk_v0` — point geometries with attributes `CARRETERA`, `PK`, `SENTIDO`, `IDCTRAMO`
- WFS requests use `outputFormat=application/json` and `srsName=EPSG:3857` (matching the map projection) throughout

`Shapes/PK_v0.3.gpkg` is the local source GeoPackage this layer is published from; `datos/` holds project asset folders by type (geojson/raster/documentos/imagenes/kml), currently mostly empty scaffolding for future layer blocks.

## Conventions (from `BIDELAN.md`)

- File names: all lowercase (e.g. `pk_v0.geojson`, `tramos.geojson`)
- JS variables/functions: `camelCase`, and **named in Spanish** matching the rest of the codebase (e.g. `cambiarVisibilidadCapa`, `mostrarInfoPK`, `datosPK`)
- Classes: `PascalCase`
- CSS class names: kebab-case Spanish (e.g. `.bloque-buscador`, `.ficha-pk-panel`)
- Design philosophy stated in `BIDELAN.md`: never copy code without understanding it; design first, then implement, then test
- JS functions use `function` expressions/declarations (not arrow functions) throughout — keep this style consistent when adding code
- Promise chains (`.then`/`.catch`) are used for async/fetch calls rather than `async`/`await` — follow this existing pattern

## Reference docs

`docs/API-IDEE/` documents which API-IDEE features have been explored/used (see `00_INDICE.md` for the checklist: WMS, WMTS, BackImgLayer, popups, buscador, and WFS are done; OGC API Features, StoryMap, filters, symbology, events, plugins are not yet started). `ROADMAP_BIDELAN.md` tracks planned versions (v2.0 road filter + symbology by direction, v2.1 tramo documentation, v3.0 OGC API/editing/users/dashboard). Check the roadmap before assuming a sidebar placeholder ("Próximamente") is in scope.

## Versioning

Each shipped change gets a `vX.Y` entry appended to the "Versiones" section of `BIDELAN.md` and mirrored in git commit message prefixes (see `git log`, e.g. `v1.7 Ortofoto por defecto y zoom automático a pk_v0`). When completing a unit of work, update both.
