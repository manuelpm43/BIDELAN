# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

BIDELAN is a static web viewer (no build step, no package manager) for querying kilometer points (*puntos kilométricos*, PK) on roads. It's built on the **API-IDEE** web mapping library (Spanish national geoportal's OpenLayers-based API) and serves data from a **GeoServer** instance via WMS (map rendering) and WFS (feature queries).

There is no dev server, bundler, or test suite for the frontend — it's plain HTML/CSS/JS opened directly or served statically. To work on it, open `index.html` in a browser (e.g. via a simple static file server) and use browser DevTools for debugging.

The project also includes a small **Node.js/Express authentication backend** (`backend/`) with login/registration and admin approval, and is **deployed live in production** — see "Authentication backend" and "Deployment" below. That part *does* have a real process manager, database and reverse proxy in front of it; only the frontend is build-free/static.

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

`index.html` itself has **no login gate** — it does not load `js/config.js`/`js/auth.js` and doesn't check for a token. The map viewer is open; only `login.html` and `admin.html` are separate entry points that talk to the auth backend (see below). Adding an access gate to `index.html` has been discussed but is not implemented — don't assume it exists.

### Data source

All feature data currently comes from one GeoServer instance and one layer:
- WMS/WFS base URL: `https://visor.geospatiallab.xyz/geoserver/bidelan/ows` (WFS) and `.../geoserver/bidelan/wms` (WMS) — nginx en el servidor (217.71.202.62) hace de proxy inverso HTTPS hacia GeoServer, que escucha internamente en el puerto 8080. El visor completo (mapa, login/registro, panel admin) vive en el subdominio `visor.geospatiallab.xyz`; la raíz `geospatiallab.xyz` es una página aparte, no forma parte de este proyecto.
- Layer: `bidelan:pk_v0` — point geometries with attributes `CARRETERA`, `PK`, `SENTIDO`, `IDCTRAMO`
- WFS requests use `outputFormat=application/json` and `srsName=EPSG:3857` (matching the map projection) throughout

`Shapes/PK_v0.3.gpkg` is the local source GeoPackage this layer is published from; `datos/` holds project asset folders by type (geojson/raster/documentos/imagenes/kml), currently mostly empty scaffolding for future layer blocks.

## Authentication backend (`backend/`, `login.html`, `admin.html`)

A separate Node.js/Express API handles login and registration; it is a distinct runtime from the static frontend (its own `package.json`, not loaded by `index.html`).

- **Entry points**: `login.html` (register/login, loads `js/config.js` + `js/auth.js`) and `admin.html` (approve/reject pending signups, loads `js/config.js` + `js/admin.js`). `js/config.js` defines the shared globals `apiAuthUrl` and `claveTokenAuth` (the `localStorage` key holding the JWT).
- **Backend routes** (`backend/auth.js`, `backend/admin.js`): `POST /auth/register`, `POST /auth/login`, and admin-only `GET /admin/usuarios/pendientes`, `POST /admin/usuarios/:id/aprobar`, `POST /admin/usuarios/:id/rechazar` (protected by `backend/middlewareAdmin.js`, which requires a JWT with `rol: 'admin'`).
- **Approval flow**: registering creates a user with `aprobado = false`; they cannot log in until an admin approves them from `admin.html`. `backend/bootstrapAdmin.js` runs on every server start and creates/promotes the account named by `ADMIN_EMAIL`/`ADMIN_PASSWORD` (in `.env`) to `rol = 'admin', aprobado = true` — this is what guarantees there's always at least one admin able to approve everyone else.
- **Storage**: PostgreSQL, table `usuarios` (`id`, `nombre`, `email`, `password_hash`, `rol`, `aprobado`, `creado_en`) — see `backend/sql/001_crear_usuarios.sql` and `002_aprobacion_usuarios.sql`. Passwords are bcrypt-hashed; emails are normalized (`trim` + lowercase) before every insert/lookup.
- **Tokens**: JWT signed with `JWT_SECRETO`, carrying `id`, `email`, `rol`. The frontend stores it under `claveTokenAuth` in `localStorage` and sends it as `Authorization: Bearer <token>` on admin calls.
- **Hardening already in place**: `express-rate-limit` on `/auth/*` (20 req/15min/IP), optional PostgreSQL SSL via `PGSSLMODE`, `app.set('trust proxy', 1)` so rate-limiting sees the real client IP behind nginx.
- There is a mock mode (`modoMockAuth` in `js/auth.js`) that simulated these endpoints in `localStorage` before the real backend existed. It's currently `false` (real backend is live) — don't re-enable it without a reason.

## Deployment

BIDELAN runs live on a single Ubuntu 26.04 VPS at `217.71.202.62`, alongside GeoServer (which predates this project and is not managed from this repo).

- **Domains** (Cloudflare DNS, proxy off / "DNS only" so Certbot's HTTP-01 challenge works directly against the origin):
  - `visor.geospatiallab.xyz` — the entire BIDELAN app: static frontend, `/auth`, `/admin`, and a `/geoserver/` proxy to GeoServer. This is the domain the frontend code points to (`js/config.js` → `apiAuthUrl`, `js/app.js` → `geoserverWfsUrl` and the WMS layer URL).
  - `geospatiallab.xyz` / `www` — **not part of BIDELAN**. Serves an unrelated "under construction" placeholder (`/var/www/geospatiallab-placeholder`). Don't repoint BIDELAN URLs here.
  - `geoserver.geospatiallab.xyz` — legacy CNAME to the old `montija-geoserver.duckdns.org`, currently unused.
- **nginx** (`/etc/nginx/sites-available/visor` and `/geospatiallab`, both symlinked into `sites-enabled`): TLS terminates here (Let's Encrypt via Certbot, auto-renewed by `certbot.timer`). The `visor` site's `root` is `/opt/bidelan` (the git checkout — see below); it denies direct access to `/backend/`, `/.git/`, `/Shapes/`, `/datos/`, `/docs/`, and reverse-proxies `/geoserver/` → `127.0.0.1:8080`, `/auth/` and `/admin/` → `127.0.0.1:4000`.
- **Backend process**: PM2, process name `bidelan-auth`, running `/opt/bidelan/backend/server.js` (port 4000, internal only). Its `.env` (PostgreSQL creds, `JWT_SECRETO`, `ORIGEN_PERMITIDO`, `ADMIN_EMAIL`/`ADMIN_PASSWORD`, etc.) lives only on the server and is gitignored.
- **Code deployment**: `/opt/bidelan` is a plain `git clone` of `github.com/manuelpm43/BIDELAN` (public repo). Deploying an update is `cd /opt/bidelan && git pull`, then for backend changes `cd backend && npm install --production && pm2 restart bidelan-auth`. There's a backup of the pre-git manual deployment at `/opt/bidelan-backend.bak` (safe to remove once the current setup has proven stable).
- **PostgreSQL**: local to the same server, database `bidelan`, role `bidelan_auth` owns the `usuarios` table only — shares the instance with whatever backs GeoServer, but not the same schema.

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

**Note this discrepancy**: `ROADMAP_BIDELAN.md` still lists "Usuarios" under future v3.0 scope, but user authentication was actually built and deployed already (v1.8–v2.4 in `BIDELAN.md`, see "Authentication backend" and "Deployment" above) — it just happened out of the roadmap's original order. Trust `BIDELAN.md`'s version log and this file over `ROADMAP_BIDELAN.md` for what's actually done.

## Versioning

Each shipped change gets a `vX.Y` entry appended to the "Versiones" section of `BIDELAN.md` and mirrored in git commit message prefixes (see `git log`, e.g. `v1.7 Ortofoto por defecto y zoom automático a pk_v0`). When completing a unit of work, update both.
