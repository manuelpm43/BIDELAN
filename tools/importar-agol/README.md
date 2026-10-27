# importar-agol

Migra capas de ArcGIS Online (`bidegi.maps.arcgis.com`) a la base de datos PostgreSQL/PostGIS
del servidor de BIDELAN (base `bidelan`, schema `public`, la misma instancia que usa GeoServer), adjuntos incluidos.

## Instalación

```
cd tools/importar-agol
npm install
copy .env.example .env
```

Rellena `.env` con:
- **Autenticación en ArcGIS Online** — usa `AGOL_API_KEY` (recomendado; ver más abajo cómo generarla). Si la
  dejas vacía, el script cae al método usuario/contraseña (`AGOL_USUARIO`/`AGOL_PASSWORD`), pero algunas
  organizaciones bloquean ese método a nivel de API aunque el login normal por navegador funcione (típico en
  cuentas de administrador), dando el error "Invalid username or password" aunque las credenciales sean correctas.
- Credenciales de PostgreSQL (`PGUSER`/`PGPASSWORD`: reutiliza el rol que ya usa el datastore de GeoServer;
  necesita `CREATE`/`USAGE` sobre el schema `public` — ver `GRANT` en `.env.example` si hace falta concederlo).
- Credenciales SSH (`SSH_USUARIO` + `SSH_KEY_PATH` o `SSH_PASSWORD`) para subir los adjuntos por SFTP a
  `/opt/bidelan/datos/adjuntos/`.

El puerto 5432 está restringido por IP en el firewall del servidor — si la tuya no está en la lista
blanca, usa un túnel SSH (`ssh -L 15432:localhost:5432 <usuario>@217.71.202.62`, déjalo abierto) y cambia
`PGHOST=localhost`, `PGPORT=15432` en tu `.env`. El servidor también exige SSL: `PGSSLMODE=require`.

## Generar la API Key en ArcGIS Online

1. Entra en `https://bidegi.maps.arcgis.com` con una cuenta con privilegios de administrador.
2. Ve a **Organización → Configuración → Claves de API** (en inglés: *Organization → Settings → API keys*).
3. Pulsa **Nueva clave de API** (*New API key*).
4. Dale un nombre (p. ej. "importar-agol BIDELAN") y en privilegios marca al menos **Contenido: Consulta de
   privilegios** (*Content: Privileges — Query*) y, si las capas tienen adjuntos, el privilegio de lectura de
   adjuntos (*Attachments*). Si el asistente te deja elegir a qué elementos se aplica, puedes restringirla a
   los ítems que vayas a migrar o dejarla a nivel de organización si prevés ir migrando muchos.
5. Al crearla te muestra la clave **una sola vez** — cópiala y pégala en `.env` como `AGOL_API_KEY=...`
   (solo en el archivo, no me la escribas a mí por chat).

## Uso

```
node importar-capa.js --capa "Nombre exacto de la capa en ArcGIS Online"
```

Opciones:
- `--item-id <id>` — usar el id del item de ArcGIS Online en vez de buscar por título (necesario si hay varios
  elementos con el mismo nombre entre los 500+ de la organización).
- `--indice <n>` — si el Feature Service tiene varias subcapas, elige cuál importar (el script lista los índices
  disponibles si hace falta).
- `--limite <n>` — en vez de importar la capa entera, elige **`n` features al azar** (de verdad al azar entre
  todo el OBJECTID de origen, no las primeras `n`) y solo trae esas — adjuntos incluidos, solo de esas features.
  Pensado para capas de gran volumen donde quieres una muestra para probar antes de decidir importarlo todo. Si
  `n` es mayor o igual que el total de la capa, se importan todas (con aviso). Combínalo con `--simular` para ver
  qué OBJECTID saldrían elegidos sin escribir nada todavía.
- `--simular` — resuelve el item, infiere columnas/tipo de geometría y cuenta features/adjuntos, sin escribir
  nada en Postgres ni descargar nada. Útil para comprobar antes de importar de verdad.
- `--forzar` — si la tabla destino ya existe, la borra y la recrea en vez de abortar.

## Qué crea

- `public.<nombre_capa>` — una fila por feature, `objectid_agol` como clave primaria (mapea al `OBJECTID` de
  origen), columna `geom geometry(<Tipo>, 3857)` si la capa es espacial (EPSG:3857, igual que `pk_v0`).
- `public.<nombre_capa>_adjuntos` — solo si la capa tiene adjuntos: referencia el `objectid_agol` de la fila y
  guarda `ruta_relativa` (relativa a `/opt/bidelan/`) del archivo subido al servidor.
- `public.capas_importadas_agol` — tabla de auditoría (una fila por capa importada, con fecha y recuento),
  para llevar el control de cuáles de los 500+ elementos ya se han migrado.

El nombre de la tabla es el título de ArcGIS Online normalizado a un identificador de Postgres válido
(minúsculas, sin acentos, espacios/símbolos como `_`).

Las tablas resultantes quedan en el mismo schema que `pk_v0`, listas para publicarse en GeoServer. Por defecto
el script no publica nada ahí, solo deja los datos en Postgres — pero si rellenas las variables `GEOSERVER_*`
del `.env` (ver `.env.example`), publica la capa automáticamente al terminar, vía la API REST de GeoServer
(equivalente a "Add a new layer > Publish" en la interfaz web, con el bounding box calculado solo).

Eso deja la capa visible por WMS/WFS, pero **añadirla al visor** (`js/app.js`: capa WMS + entrada en
`capasVisor`, más su casilla en `index.html`) sigue siendo un paso aparte — pídeselo a Claude Code, es
rápido y cada capa necesita alguna decisión (símbolo, grupo del panel, título) que no tiene sentido
automatizar a ciegas.

## Permisos pendientes después de importar (a mano, una vez por capa)

Este script se conecta como el rol de `PGUSER` del `.env` (normalmente el superusuario `postgres` o uno con
privilegios amplios), así que las tablas quedan creadas **sin permisos para los roles más limitados** que
usan los demás servicios — y ninguno de esos roles falla con un error claro: simplemente no "ven" la tabla
en `information_schema`, como si no existiera. Dos concesiones a hacer siempre tras importar una capa nueva
(sustituyendo `<tabla>` por el nombre real):

```sql
-- Para que GeoServer pueda servirla por WMS/WFS (datastore bidelan_nube, rol geoserver_ro):
GRANT SELECT ON public.<tabla> TO geoserver_ro;

-- Para que el backend de autenticación pueda servir sus adjuntos (rol bidelan_auth):
GRANT SELECT ON public.<tabla> TO bidelan_auth;
GRANT SELECT ON public.<tabla>_adjuntos TO bidelan_auth;
```

Sin la primera, la capa no aparece en GeoServer aunque esté "publicada". Sin las otras dos, la ficha del
visor no da error pero la pestaña ADJUNTOS sale siempre vacía — `backend/adjuntos.js` devuelve 404 como si
la tabla `_adjuntos` no existiera, cuando en realidad es que `bidelan_auth` no tiene permiso para verla.
