# PROYECTO BIDELAN

## Objetivo

Desarrollar un visor web para la consulta de puntos kilométricos de carreteras (capa `bidelan:pk_v0`) utilizando la API-IDEE, con datos servidos desde GeoServer (WMS + WFS).

---

# Arquitectura

La aplicación estará formada por cinco bloques principales:

- Header
- Panel de capas
- Mapa
- Panel de información
- Footer

---

# Estructura del proyecto

BIDELAN/

├── css/

├── datos/

│ ├── geojson/

│ ├── raster/

│ ├── documentos/

│ └── imagenes/

├── img/

├── js/

└── index.html

---

# Convenciones

## Archivos

Todo en minúsculas.

Ejemplo:

pk_v0.geojson

tramos.geojson

---

## Variables JavaScript

camelCase

Ejemplo:

const mapa

const capaPKv0

const geoserverWfsUrl

---

## Clases

PascalCase

---

# Filosofía

Nunca copiar código sin entenderlo.

Primero diseñar.

Después programar.

Finalmente probar.

---

# Versiones

v1.0 Limpieza del esqueleto PRESAS y adaptación del buscador a tramos/PK

v1.1 Capa WMS bidelan:pk_v0

v1.2 Checkbox de visibilidad

v1.3 Panel de información vía WFS al hacer click

v1.8 Página de login/registro (POST /auth/login, /auth/register) con guardado de token y redirección al visor, con modo mock temporal en localStorage mientras no exista backend

v1.9 Backend real de autenticación (Node/Express + PostgreSQL + JWT) desplegado junto a GeoServer, sustituyendo el mock

v2.0 Flujo de aprobación de altas: los registros nuevos quedan pendientes hasta que un administrador los aprueba desde admin.html

v2.1 CORS multi-origen (localhost y 127.0.0.1) y arreglo del aviso de modo mock en login.html

v2.2 Backend: emails normalizados, límite de intentos en /auth, bootstrap automático de la cuenta admin inicial y SSL opcional para PostgreSQL

v2.3 Despliegue en https://geospatiallab.xyz: GeoServer y backend de auth detrás de nginx con HTTPS, visor y backend en el mismo origen

v2.4 El visor se traslada a su propio subdominio https://visor.geospatiallab.xyz (la raíz del dominio queda libre para otros usos)

v2.5 Herramienta `tools/importar-agol` para migrar capas de ArcGIS Online (bidegi.maps.arcgis.com) a PostgreSQL/PostGIS, adjuntos incluidos

v2.6 Publica `partes_accidentes` en GeoServer (workspace bidelan) y la añade al visor como capa WMS con su checkbox de visibilidad, primera capa migrada desde ArcGIS Online

v2.7 Edición de datos del mapa desde el visor: nuevo rol `editor`, endpoints `/edicion` en el backend (crear/mover/borrar/editar atributos con auditoría), y controles de edición en la ficha para capas registradas en `capas_editables`

v2.8 Da de alta `pk_v0` como capa editable (con reproyección automática 3857→25830 al guardar, ya que su geometría nativa no está en la proyección del mapa) y cabecera de la ficha dinámica según la capa

v2.9 Visualización de adjuntos (fotos) en la ficha para usuarios con sesión iniciada: nueva ruta `/adjuntos` en el backend que sirve los archivos de `datos/adjuntos/` de forma controlada, sin abrir acceso público directo en nginx

v3.0 Autorelleno de `CARRETERA`, `TIPO`, `PK`, `SENTIDO` y `SITUACION` al crear un punto: nueva ruta `/edicion/sugerencia/:tabla` que consulta el eje más cercano en `tramos_calibrados_prueba` (PostGIS) y precarga el formulario, con valores editables. Activado por capa con `capas_editables.sugerencias_viales` (`pk_v0` y `partes_accidentes`)

v3.1 Añade la capa de ejes de carretera (`bidelan:tramos_calibrados_prueba`) al visor como WMS con su casilla en Geometría, para ver dónde hacer clic al colocar un punto (solo visualización, no consultable ni editable)

v3.2 Ficha con pestañas GEOMETRIA (los cinco campos fijos, comunes a todas las capas) / DATOS (el resto) / ADJUNTOS, tanto en lectura como en el formulario de edición. Los editores pueden subir fotos y PDF desde ADJUNTOS: nueva ruta `POST /adjuntos/:tabla/:pk` (cuerpo binario, máx. 15 MB, con auditoría) y tabla `pk_v0_adjuntos`

v3.3 El PK se divide en dos campos: `PK` (parte entera, el hito) y `PK_CALCULADO` (metros recorridos sobre el segmento del eje, que pueden superar 1000 en tramos largos, p. ej. 2 + 1050)

v3.4 La ficha lee los atributos directamente de Postgres (`GET /edicion/atributos/:tabla/:pk`, pública, solo campos_editables) en vez de depender de las columnas que GeoServer conocía al publicar la capa; el WFS queda solo para localizar el elemento

---

# Estado del proyecto

En desarrollo.
