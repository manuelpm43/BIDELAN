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

El puerto 5432 del servidor ya es accesible directamente (confirmado con la conexión de QGIS a
`217.71.202.62:5432`), así que `.env.example` conecta directo sin túnel. Si en tu caso no fuera accesible,
usa un túnel SSH (`ssh -L 5433:localhost:5432 <usuario>@217.71.202.62`) y cambia `PGHOST=localhost`,
`PGPORT=5433` en tu `.env`.

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

Las tablas resultantes quedan en el mismo schema que `pk_v0`, listas para publicarse en GeoServer más adelante
si procede — este script no publica nada en GeoServer, solo deja los datos en Postgres.
