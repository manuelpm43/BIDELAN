// Publica una tabla ya existente en Postgres como capa en GeoServer, vía su
// API REST — equivalente a "Layers > Add a new layer > Publish" en la
// interfaz web, pero automatizado. Paso opcional: si GEOSERVER_URL no está
// configurado en .env, publicarCapa() no hace nada (el resto de la
// importación sigue funcionando igual que siempre).

function estaConfigurado(cfg) {
    return !!(cfg.GEOSERVER_URL && cfg.GEOSERVER_WORKSPACE && cfg.GEOSERVER_DATASTORE
        && cfg.GEOSERVER_USUARIO && cfg.GEOSERVER_PASSWORD);
}

function cabeceraAuth(cfg) {
    const credenciales = Buffer.from(`${cfg.GEOSERVER_USUARIO}:${cfg.GEOSERVER_PASSWORD}`).toString('base64');
    return `Basic ${credenciales}`;
}

/**
 * Publica nombreTabla (ya creada e insertada en Postgres) como capa nueva
 * en el datastore/workspace configurados. recalculate=nativebbox,latlonbbox
 * le pide a GeoServer que calcule el bounding box a partir de los datos
 * reales, igual que el botón "Compute from data" de la interfaz web.
 *
 * @returns {string|null} "<workspace>:<tabla>" (nombre completo de la capa
 *   en WMS/WFS) si se publicó, o null si GeoServer no está configurado.
 */
async function publicarCapa(cfg, nombreTabla, { titulo, tieneGeometria } = {}) {
    if (!estaConfigurado(cfg)) {
        return null;
    }

    const url = `${cfg.GEOSERVER_URL}/rest/workspaces/${cfg.GEOSERVER_WORKSPACE}/datastores/${cfg.GEOSERVER_DATASTORE}/featuretypes?recalculate=nativebbox,latlonbbox`;

    const featureType = {
        name: nombreTabla,
        nativeName: nombreTabla,
        title: titulo || nombreTabla,
        enabled: true
    };
    if (tieneGeometria) {
        featureType.srs = 'EPSG:3857';
    }

    const respuesta = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: cabeceraAuth(cfg)
        },
        body: JSON.stringify({ featureType })
    });

    if (!respuesta.ok) {
        const texto = await respuesta.text().catch(() => '');
        throw new Error(`GeoServer rechazó la publicación (HTTP ${respuesta.status}): ${texto.slice(0, 500)}`);
    }

    return `${cfg.GEOSERVER_WORKSPACE}:${nombreTabla}`;
}

module.exports = { estaConfigurado, publicarCapa };
