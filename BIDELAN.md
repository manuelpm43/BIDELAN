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

v3.5 Modo local (`MODO_LOCAL=1`): el backend puede servir también el visor en `http://localhost:4000` hablando directo con la BD real del VPS, para trabajar desde redes que bloqueen `*.geospatiallab.xyz` (p. ej. el filtro web corporativo de Panda)

v3.6 Sustituye la capa de ejes de prueba `tramos_calibrados_prueba` (67 filas) por la definitiva `eje_ref_tramo` (431 filas, publicada en GeoServer): autorelleno vial y capa visual migrados, `SENTIDO` ahora viene directo de la columna `eje_sentido` en vez de parsearse del nombre del eje. Tabla vieja eliminada de Postgres y despublicada de GeoServer

v3.7 Los cuatro bloques principales del panel (ACTIVOS, CAMPAÑAS, FILTRADO RESULTADOS, ANÁLISIS) pasan a ser desplegables y empiezan cerrados, para que junto al buscador se vean solo sus cabeceras al entrar

v3.8 Simbología de `pk_v0` fiel a QGIS: nueva carpeta `estilos/` (un `.sld` por capa, exportado desde QGIS) como punto de entrega; `pk_v0.sld` subido a GeoServer como estilo `pk_v0_qgis` y puesto por defecto en la capa — colores por carretera y densidad de etiquetas según el zoom, igual que en QGIS

v3.9 Arregla la detección de "modo local": exigía solo `localhost`/`127.0.0.1`, así que abrir el proyecto con Live Server (puerto 5500) hacía que `js/config.js` y `js/app.js` llamasen a la API/GeoServer en ese mismo puerto, donde no hay nada escuchando. Ahora exige además el puerto 4000 (donde corre de verdad `MODO_LOCAL`); Live Server sigue llamando a producción como siempre

v3.10 Elimina por completo el "modo local" (`MODO_LOCAL`, detección de `localhost`/puerto 4000 en `config.js`/`app.js`, servido del frontend desde el propio backend): ha sido fuente de bugs repetidos y el visor pasa a apuntar siempre a producción, sin ramas condicionales. De paso, arreglado el fallo real del día: el symlink de `visor` había desaparecido de `/etc/nginx/sites-enabled/` del servidor (al trabajar en el proyecto `cortes`, ajeno a BIDELAN, en la misma máquina), dejando `/auth/login` sirviendo el sitio equivocado — restaurado, más una nota en CLAUDE.md para la próxima vez

v3.11 Limpieza de infraestructura (22 oct): eliminados `campo.geospatiallab.xyz` y `geoserver.geospatiallab.xyz`/`montija-geoserver.duckdns.org` (en desuso); `cortes.geospatiallab.xyz` recuperado y arreglado el bucle de redirección (Cloudflare a "Completo estricto"); GeoServer ahora anuncia URLs `https://` correctas en `GetCapabilities` (Proxy Base URL en `global.xml` + `proxy_redirect` en nginx). Activar el proxy de Cloudflare en `visor.geospatiallab.xyz` empeoró el bloqueo de Panda en el trabajo (pasó de "sitios nuevos" a "anonimizadores"): se revierte a "Solo DNS" y se descarta esa vía

v3.12 Corrige XSS almacenado en `admin.html`: `js/admin.js` pintaba `nombre`/`email` de los usuarios directo en `innerHTML`, sin escapar — como `nombre` lo rellena cualquiera al registrarse sin autenticación, un registro malicioso podía ejecutar script con la sesión del primer admin que abriera el panel (y robar su JWT de `localStorage`). Pasado a `textContent` en las dos tablas (pendientes y usuarios), misma protección que ya tenía la ficha del mapa (`escaparHtml()` en `panel.js`)

v3.13 Límite general de 120 peticiones/minuto por IP en todo el backend (`backend/server.js`), además del límite propio de `/auth`: `/edicion/atributos` (pública) y `/edicion`/`/adjuntos` (autenticadas) no tenían ningún freno. Contraseña mínima subida de 6 a 10 caracteres (backend, `js/auth.js` y `login.html`, los tres consistentes)

v3.14 `index.html` exige sesión iniciada para ver el mapa: nuevo `js/sesion.js` redirige a `login.html` si no hay token guardado, antes incluso de crear el mapa (ninguna petición a GeoServer sin login). Comprobación de presencia del token en el cliente, igual que ya hacía `admin.html` — la validez real del token la sigue comprobando el backend en cada petición a `/edicion`/`/adjuntos`

v3.15 Primera capa `AUS_ESTRUCTURAS_2026` (auscultación de estructuras), muestra de 20 elementos al azar sobre 261, con sus documentos adjuntos: `tools/importar-agol` gana `--limite <n>` (elige n OBJECTID al azar en origen, sin descargar la capa entera) y publicación opcional en GeoServer vía su API REST (`src/geoserver.js`, variables `GEOSERVER_*` en `.env`). Nueva capa `bidelan:aus_estructuras_2026` (polígonos) en el grupo "Estructuras" del panel, antes un "Próximamente" — primer uso real de ese bloque

v3.16 Panel "Tabla de atributos" al estilo ArcGIS Online: pestaña inferior del mapa (nuevo `js/tablaAtributos.js`) con una pestaña por cada capa de `capasVisor` (hoy `pk_v0`, `partes_accidentes`, `aus_estructuras_2026`), tabla con todos sus atributos vía WFS, botón "Zoom to" por fila (encuadra el mapa sobre esa geometría, de cualquier tipo) y "Filtrar por extensión de mapa" para acotar la tabla a lo visible

v3.17 Cache-busting (`?v=3.16` → ahora `?v=3.17`) en todos los `<script>`/`<link>` propios de `index.html`, `login.html` y `admin.html`: `js/app.js` se quedó sirviendo una versión vieja en el navegador de un usuario durante horas (con `capasVisor` sin la capa nueva) pese a recarga forzada y ventana de incógnito — solo cambiar la URL del fichero (subiendo el número de versión) forzó a descargarlo de verdad. A partir de ahora, subir este número en cada versión nueva

v3.18 El clic en el mapa pasa a consultar automáticamente todas las capas de `capasVisor` (antes solo `pk_v0` y, a mano, `partes_accidentes` — `aus_estructuras_2026` se había quedado sin ficha al hacer clic). Ficha de `aus_estructuras_2026` curada a 4 campos (`NOMBRE`, `TIPOLOGIA`, `OBSERVACIONES`, `AUSCULTACION_VALIDACION`) en vez de volcar los ~90 campos de ArcGIS Online, mismo patrón que ya tenía `pk_v0` (`js/panel.js`)

v3.19 Los adjuntos de `aus_estructuras_2026` no se veían: `backend/adjuntos.js` solo servía adjuntos de tablas dadas de alta en `capas_editables`, y esta capa no lo está a propósito (para no sacar botones de editar con un formulario sin sentido para sus ~90 campos). `buscarCapa()` gana una segunda vía: si la tabla no está en `capas_editables`, comprueba que exista su `<tabla>_adjuntos` (nombre validado antes de tocar SQL) y usa `objectid_agol` como PK — así cualquier capa importada por `tools/importar-agol` sirve sus adjuntos sin necesidad de activar edición para ella

v3.20 Los 4 campos de la ficha de `aus_estructuras_2026` salían siempre vacíos: `js/panel.js` los tenía en MAYÚSCULAS (`NOMBRE`, `TIPOLOGIA`...) pero las columnas reales en Postgres/WFS están en minúsculas (así las crea `tools/importar-agol` al sanear los nombres de ArcGIS Online) — no faltaban datos, era un problema de mayúsculas/minúsculas

---

# Estado del proyecto

En desarrollo.
