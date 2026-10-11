# Estilos de capas (QGIS → GeoServer)

Convención: un archivo `.sld` por capa, con el **mismo nombre exacto que
la capa en GeoServer** (sin el prefijo `bidelan:`).

Ejemplo: la simbología de la capa `pk_v0` se guarda aquí como
`pk_v0.sld`.

## Cómo generar el archivo desde QGIS

1. Clic derecho en la capa → **Propiedades** → pestaña **Simbología**.
2. Botón **Estilo** (abajo a la izquierda) → **Guardar estilo...**
3. Formato: **Archivo de estilo SLD**.
4. Guardarlo aquí, en `estilos/`, con el nombre de la capa.

## Qué hace falta para que se vea en el visor

Dejar el archivo aquí (o actualizarlo) **no cambia nada por sí solo**:
BIDELAN no lee esta carpeta en tiempo real, es solo el punto de
entrega. El estilo hay que subirlo a GeoServer (vía su API REST) y
asignarlo a la capa — eso se hace a mano cada vez que se añade o
actualiza un archivo aquí.
