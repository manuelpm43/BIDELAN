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

0. `config.js` — shared constants, loaded **before everything else** so later files can use them: `apiAuthUrl`, `claveTokenAuth` (both hardcoded to production, no environment branching — see "No local/offline mode" under Deployment). Because all these files are loaded as classic scripts sharing one global scope (no module system), a `const` declared in two of them is a page-breaking `SyntaxError` — declare shared values once, here.
0.5. `sesion.js` — login gate (v3.14): redirects to `login.html` if there's no token in `localStorage`. Loaded right after `config.js`, before anything that touches the map, so an unauthenticated visit never reaches GeoServer.
1. `panel.js` — defines `mostrarInfoPK()`, `mostrarFichaPK()`, `ocultarFichaPK()` and drag behavior for the PK detail popup. Loaded early because `app.js` calls `mostrarInfoPK`.
2. `app.js` — creates the API-IDEE map (`const mapa`), configures WMTS background layers (ortofoto/cartografía/híbrido), adds the WMS layers (ejes, `bidelan:pk_v0`, partes de accidentes), auto-fits the map extent to the WFS data on load, and handles map click → WFS nearest-feature query → shows the popup via `mostrarInfoPK`. `geoserverBaseUrl` is hardcoded to production.
2.5. `tablaAtributos.js` — bottom "Tabla de atributos" tab (v3.16), one sub-tab per layer in `capasVisor`, WFS-backed, with "Zoom to" per row and a filter-to-map-extent toggle. See `BIDELAN.md` v3.16–v3.22 for its history (including two display/CSS bugs that made it unable to collapse).
2.6. `streetview.js` — Google Street View (v3.24): a draggable pegman (`#pegmanStreetView`) dropped onto `#mapa` opens `#overlayStreetView` with a `google.maps.StreetViewPanorama` at that point. Fetches the Maps JS API key from the backend (`GET /config/google-maps-key`, reads `GOOGLE_MAPS_API_KEY` from `.env`) rather than having it hardcoded — the key still ends up in the browser either way (that's how Maps JS API works), the point is keeping it out of the git history. Converts the drop point from the map's EPSG:3857 to WGS84 by hand (no projection library available client-side); gets the point itself via `mapa.getMapImpl().getCoordinateFromPixel(...)`, the escape hatch into API-IDEE's underlying OpenLayers instance.
3. `buscador.js` — loads all `bidelan:pk_v0` features via WFS once on startup into `datosPK`, then implements the sidebar search input: live filtering/suggestions and Enter-to-select, both matching against `"<CARRETERA> · PK <PK>"` (normalized, accent-insensitive).
4. `capas.js` — wires the `#checkPKv0` checkbox to toggle the underlying OpenLayers layer visibility via `cambiarVisibilidadCapa()`.
5. `adjuntos.js`, `edicion.js` — attachment viewing and the map-editing flow (editor/admin roles, `/edicion` and `/adjuntos` backend routes); see `BIDELAN.md`'s v2.7–v3.4 entries for how these work, not fully re-documented here yet.

Key shared globals (declared with `const`/`let` at top level, relied on across files since there's no module system): `apiAuthUrl`, `claveTokenAuth` (from `config.js`), `mapa`, `geoserverWfsUrl`, `geoserverBaseUrl`, `capaPKv0`, `datosPK`.

`index.html` has a login gate as of v3.14: `js/sesion.js`, loaded right after `js/config.js` and before `js/panel.js`/`js/app.js`, redirects to `login.html` if `localStorage[claveTokenAuth]` is missing — this runs before the map is even created, so an unauthenticated visitor never triggers a single GeoServer request. It's a **client-side presence check only** (same shallow pattern `admin.html` already used), not a validity check: an expired or tampered token still passes this gate and lets the page render, it just fails later server-side the moment any `/edicion` or `/adjuntos` call actually needs a valid JWT. It also doesn't lock down GeoServer's WMS/WFS endpoints or the public `/edicion/atributos/:tabla/:pk` route themselves — someone with the direct URLs can still reach the underlying data without going through `index.html` at all. `login.html` and `admin.html` are the separate entry points that actually talk to the auth backend.

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

- **Domains** (Cloudflare DNS):
  - `visor.geospatiallab.xyz` — the entire BIDELAN app: static frontend, `/auth`, `/admin`, and a `/geoserver/` proxy to GeoServer. This is the domain the frontend code points to (`js/config.js` → `apiAuthUrl`, `js/app.js` → `geoserverWfsUrl` and the WMS layer URL). Stays **"DNS only"** (grey cloud, proxy off) — needed for Certbot's HTTP-01 renewal, and because turning its Cloudflare proxy ON has actually made a workplace web filter block it *worse* (reclassified from "sitios nuevos" to "anonimizadores") — don't toggle this one to proxied.
  - `geospatiallab.xyz` / `www` — **not part of BIDELAN**. Serves an unrelated "under construction" placeholder (`/var/www/geospatiallab-placeholder`). Don't repoint BIDELAN URLs here. Unlike `visor`, these *are* proxied (orange cloud).
  - `cortes.geospatiallab.xyz` — sibling project (`../CORTES`), also proxied; Cloudflare's SSL/TLS mode is set to "Full (strict)" for the proxied hostnames (Flexible caused a redirect loop on `cortes`).
  - `geoserver.geospatiallab.xyz` (old CNAME to `montija-geoserver.duckdns.org`) and `campo.geospatiallab.xyz` (an unrelated FastAPI/uvicorn project, `campo-api`) were both decommissioned and removed (DNS + nginx + service) on 2026-10-22 — don't expect them to exist.
- **nginx** (`/etc/nginx/sites-available/visor` and `/geospatiallab`, both symlinked into `sites-enabled`): TLS terminates here (Let's Encrypt via Certbot, auto-renewed by `certbot.timer`). The `visor` site's `root` is `/opt/bidelan` (the git checkout — see below); it denies direct access to `/backend/`, `/.git/`, `/Shapes/`, `/datos/`, `/docs/`, and reverse-proxies `/geoserver/` → `127.0.0.1:8080` and `/auth/`, `/admin/`, `/edicion/`, `/adjuntos/`, `/config/` → `127.0.0.1:4000` (every backend route needs its own `location` block added here by hand — a path that works when curled directly at `:4000` can still 404 through the public domain if nobody added its block; this bit `/health` early on and `/config/google-maps-key` when Street View was added).
- **Backend process**: PM2, process name `bidelan-auth`, running `/opt/bidelan/backend/server.js` (port 4000). Its `.env` (PostgreSQL creds, `JWT_SECRETO`, `ORIGEN_PERMITIDO`, `ADMIN_EMAIL`/`ADMIN_PASSWORD`, `GOOGLE_MAPS_API_KEY`, etc.) lives only on the server and is gitignored. Port 4000 was reachable directly from the internet in plain HTTP (bypassing nginx's TLS entirely, and letting anyone spoof `X-Forwarded-For` straight past the `trust proxy` setting) until closed in the firewall on 2026-10-23, found during a security audit — verify it's still closed (`curl http://217.71.202.62:4000/health` from outside should time out) before assuming requests only ever reach it via nginx's `127.0.0.1` proxy.
- **Code deployment**: `/opt/bidelan` is a plain `git clone` of `github.com/manuelpm43/BIDELAN` (public repo). Deploying an update is `cd /opt/bidelan && git pull`, then for backend changes `cd backend && npm install --production && pm2 restart bidelan-auth`. There's a backup of the pre-git manual deployment at `/opt/bidelan-backend.bak` (safe to remove once the current setup has proven stable).
- **PostgreSQL**: local to the same server, database `bidelan`, role `bidelan_auth` owns the `usuarios` table only — shares the instance with whatever backs GeoServer, but not the same schema. Port 5432 is reachable directly from the internet (confirmed via a working QGIS connection straight to `217.71.202.62:5432`). **At risk**: restricting 5432 to specific IPs is on an optional cleanup list (not done as of 2026-10-22) — if that happens, any direct-connect tool (QGIS included) needs its IP allowed, or it'll stop reaching the database.
- **GeoServer**: installed at `/opt/geoserver` (`data_dir` at `/opt/geoserver/data_dir`), run as a systemd service (`geoserver.service`, runs as `root`, Jetty/`start.jar`, not the bin-distribution that ships `resetadminpassword.sh`). Workspace `bidelan`, PostGIS datastore `bidelan_nube` (connects to Postgres as the dedicated **read-only** role `geoserver_ro`, via `localhost:5432` — a new table only becomes queryable by WMS/WFS once `GRANT SELECT ON public.<tabla> TO geoserver_ro;` is run, since tables created by `tools/importar-agol` are owned by whichever role ran the import, not `geoserver_ro`). Confirmed (2026-10-22) nothing else (QGIS, `/opt/bidelan`, `cortes`, `bidelan-auth`) talks to GeoServer on port 8080 directly anymore — closing that port in the firewall (on the optional cleanup list, not done yet) should be safe. Proxy Base URL is set properly in `global.xml` (`${X-Forwarded-Proto}://${Host}/geoserver`), with matching `proxy_redirect` in the `visor`/`cortes` nginx configs, so `GetCapabilities` correctly advertises `https://` URLs.
- **GeoServer admin login is broken (since at least 2026-10-27, unconfirmed how long before)**: both the web UI form login and REST Basic Auth return HTTP 500, `org.jasypt.exceptions.EncryptionOperationNotPossibleException` thrown from `JasyptPasswordEncoderWrapper.isPasswordValid` during `DaoAuthenticationProvider.additionalAuthenticationChecks` — i.e. it fails *inside* GeoServer's own password-matching code, for any user/password combo, not a wrong-credentials issue (reproduced with a freshly-generated, known-correct `digest1:` hash written directly into `security/usergroup/default/users.xml`). Likely cause: something in the Jasypt-based legacy password-check path broke independently of this repo (possibly a JRE/crypto update) — not yet root-caused or fixed. **Doesn't affect the public map** — anonymous WMS/WFS (what BIDELAN's frontend uses) never goes through this code path, only admin login does. Until fixed, publish new layers by hand instead of through the UI/REST: copy an existing layer's `data_dir/workspaces/bidelan/bidelan_nube/<layer>/{featuretype,layer}.xml`, adapt name/bbox/style (bbox via `ST_Extent`/`ST_Extent(ST_Transform(geom,4326))` over SSH+psql), then `systemctl restart geoserver` — it reloads its catalog from disk on boot, no login needed. (`tools/importar-agol` also has an automated REST-based publish path, `src/geoserver.js` / `GEOSERVER_*` in `.env` — unusable until this login bug is fixed.)

**No local/offline mode.** A `MODO_LOCAL` fallback (backend serving the static frontend from itself, for networks that block the production domain) existed briefly (v3.5–v3.9) and was removed in v3.10 at the user's explicit request — it was a repeated source of bugs (e.g. a duplicate `const` declared in both `config.js` and `app.js` broke the whole page with a `SyntaxError`). `apiAuthUrl` and `geoserverBaseUrl` are now hardcoded to `https://visor.geospatiallab.xyz` unconditionally — don't reintroduce hostname/port-based branching for this.

**This server hosts other people's projects too** (`campo`, `cortes` — not part of BIDELAN). Their nginx sites-enabled entries can go missing or change independently of anything in this repo (it's happened before: `visor`'s own symlink was accidentally removed from `/etc/nginx/sites-enabled/` while someone worked on `cortes`, which silently broke `/auth/login` until noticed — nginx has no `default_server` on port 443, so unmatched SNI falls through to the first HTTPS site it finds). If the live site breaks with no corresponding code change, check `ls /etc/nginx/sites-enabled/` for `visor` before assuming it's a BIDELAN bug.

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

**Cache-busting (`?v=X.Y`)**: every local `<script src="js/...">` and `<link href="css/...">` in `index.html`, `login.html` and `admin.html` carries the current version as a query string (e.g. `js/app.js?v=3.16`). There's no build step to fingerprint filenames, and `js/app.js` specifically has gone stale in a visitor's browser for hours despite hard-refreshes and even a fresh Incognito window (likely cached somewhere between browser and origin — possibly the workplace's Panda inspection layer, never fully diagnosed) while brand-new files loaded fine the same session — bumping the query string is what actually forced a re-fetch. **Whenever you bump the version number, update this query string on every local `<script>`/`<link>` tag too** (a simple find-and-replace of the old `?v=` value), or a change can silently not reach users no matter how many times they reload.
