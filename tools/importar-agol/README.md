# importar-agol

Migra capas de ArcGIS Online (`bidegi.maps.arcgis.com`) a la base de datos PostgreSQL/PostGIS
del servidor de BIDELAN (schema `bidelan`, la misma instancia que usa GeoServer), adjuntos incluidos.

## Instalación

```
cd tools/importar-agol
npm install
copy .env.example .env
```

Rellena `.env` con:
- Usuario/contraseña de ArcGIS Online (`AGOL_USUARIO`, `AGOL_PASSWORD`).
- Credenciales de PostgreSQL (`PGUSER`/`PGPASSWORD`: reutiliza el rol que ya usa el datastore de GeoServer;
  necesita `CREATE`/`USAGE` sobre el schema `bidelan` — ver `GRANT` en `.env.example` si hace falta concederlo).
- Credenciales SSH (`SSH_USUARIO` + `SSH_KEY_PATH` o `SSH_PASSWORD`) para subir los adjuntos por SFTP a
  `/opt/bidelan/datos/adjuntos/`.

El script se ejecuta en local y se conecta a Postgres del servidor a través de un túnel SSH:

```
ssh -L 5433:localhost:5432 <usuario>@217.71.202.62
```

(deja esa terminal abierta mientras usas la herramienta; `.env.example` ya asume `PGHOST=localhost`, `PGPORT=5433`).

## Uso

```
node importar-capa.js --capa "Nombre exacto de la capa en ArcGIS Online"
```

Opciones:
- `--item-id <id>` — usar el id del item de ArcGIS Online en vez de buscar por título (necesario si hay varios
  elementos con el mismo nombre entre los 500+ de la organización).
- `--indice <n>` — si el Feature Service tiene varias subcapas, elige cuál importar (el script lista los índices
  disponibles si hace falta).
- `--simular` — resuelve el item, infiere columnas/tipo de geometría y cuenta features/adjuntos, sin escribir
  nada en Postgres ni descargar nada. Útil para comprobar antes de importar de verdad.
- `--forzar` — si la tabla destino ya existe, la borra y la recrea en vez de abortar.

## Qué crea

- `bidelan.<nombre_capa>` — una fila por feature, `objectid_agol` como clave primaria (mapea al `OBJECTID` de
  origen), columna `geom geometry(<Tipo>, 3857)` si la capa es espacial (EPSG:3857, igual que `pk_v0`).
- `bidelan.<nombre_capa>_adjuntos` — solo si la capa tiene adjuntos: referencia el `objectid_agol` de la fila y
  guarda `ruta_relativa` (relativa a `/opt/bidelan/`) del archivo subido al servidor.
- `bidelan.capas_importadas_agol` — tabla de auditoría (una fila por capa importada, con fecha y recuento),
  para llevar el control de cuáles de los 500+ elementos ya se han migrado.

El nombre de la tabla es el título de ArcGIS Online normalizado a un identificador de Postgres válido
(minúsculas, sin acentos, espacios/símbolos como `_`).

Las tablas resultantes quedan en el mismo schema que `pk_v0`, listas para publicarse en GeoServer más adelante
si procede — este script no publica nada en GeoServer, solo deja los datos en Postgres.
