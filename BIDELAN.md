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

---

# Estado del proyecto

En desarrollo.
