const fs = require('fs');
const path = require('path');

async function generarToken(cfg) {
    const params = new URLSearchParams({
        username: cfg.AGOL_USUARIO,
        password: cfg.AGOL_PASSWORD,
        referer: cfg.AGOL_ORG_URL,
        f: 'json',
        expiration: '60'
    });

    const respuesta = await fetch('https://www.arcgis.com/sharing/rest/generateToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
    });
    const datos = await respuesta.json();
    if (!datos.token) {
        throw new Error(`No se pudo autenticar en ArcGIS Online: ${JSON.stringify(datos.error || datos)}`);
    }
    return datos.token;
}

async function obtenerToken(cfg) {
    if (cfg.AGOL_API_KEY) {
        return cfg.AGOL_API_KEY;
    }
    return generarToken(cfg);
}

async function buscarItemsPorTitulo(token, titulo) {
    const q = `title:"${titulo}"`;
    const url = `https://www.arcgis.com/sharing/rest/search?q=${encodeURIComponent(q)}&f=json&token=${token}&num=50`;
    const respuesta = await fetch(url);
    const datos = await respuesta.json();
    if (datos.error) {
        throw new Error(`Error buscando "${titulo}" en ArcGIS Online: ${JSON.stringify(datos.error)}`);
    }
    return (datos.results || []).filter(item => item.title === titulo);
}

async function obtenerItem(token, itemId) {
    const url = `https://www.arcgis.com/sharing/rest/content/items/${itemId}?f=json&token=${token}`;
    const respuesta = await fetch(url);
    const datos = await respuesta.json();
    if (datos.error) {
        throw new Error(`Error obteniendo el item ${itemId}: ${JSON.stringify(datos.error)}`);
    }
    return datos;
}

const TIPOS_ITEM_SOPORTADOS = ['Feature Service', 'Table'];

async function resolverCapa(token, item, indiceCapa) {
    if (!TIPOS_ITEM_SOPORTADOS.includes(item.type)) {
        throw new Error(
            `El elemento "${item.title}" es de tipo "${item.type}", no es una capa de entidades. ` +
            `Este script solo importa Feature Service / Table.`
        );
    }

    const urlServicio = `${item.url}?f=json&token=${token}`;
    const respuesta = await fetch(urlServicio);
    const servicio = await respuesta.json();
    if (servicio.error) {
        throw new Error(`Error leyendo el servicio de "${item.title}": ${JSON.stringify(servicio.error)}`);
    }

    const subcapas = [...(servicio.layers || []), ...(servicio.tables || [])];
    if (subcapas.length === 0) {
        throw new Error(`El servicio "${item.title}" no tiene capas ni tablas.`);
    }

    let elegida;
    if (indiceCapa !== undefined && indiceCapa !== null) {
        elegida = subcapas.find(c => c.id === indiceCapa);
        if (!elegida) {
            throw new Error(`No existe la subcapa con indice ${indiceCapa} en "${item.title}".`);
        }
    } else if (subcapas.length === 1) {
        elegida = subcapas[0];
    } else {
        const listado = subcapas.map(c => `  - indice ${c.id}: ${c.name}`).join('\n');
        throw new Error(
            `"${item.title}" tiene varias subcapas, indica cual con --indice:\n${listado}`
        );
    }

    return {
        urlCapa: `${item.url}/${elegida.id}`,
        idCapa: elegida.id,
        nombreCapa: elegida.name
    };
}

async function obtenerMetadatosCapa(urlCapa, token) {
    const respuesta = await fetch(`${urlCapa}?f=json&token=${token}`);
    const datos = await respuesta.json();
    if (datos.error) {
        throw new Error(`Error obteniendo metadatos de la capa: ${JSON.stringify(datos.error)}`);
    }
    return datos;
}

async function contarFeatures(urlCapa, token) {
    const url = `${urlCapa}/query?where=1=1&returnCountOnly=true&f=json&token=${token}`;
    const respuesta = await fetch(url);
    const datos = await respuesta.json();
    if (datos.error) {
        throw new Error(`Error contando features: ${JSON.stringify(datos.error)}`);
    }
    return datos.count;
}

async function consultarFeaturesPagina(urlCapa, token, offset, cantidad) {
    const params = new URLSearchParams({
        where: '1=1',
        outFields: '*',
        f: 'geojson',
        outSR: '102100',
        resultOffset: String(offset),
        resultRecordCount: String(cantidad),
        token
    });
    const respuesta = await fetch(`${urlCapa}/query?${params.toString()}`);
    const datos = await respuesta.json();
    if (datos.error) {
        throw new Error(`Error consultando features: ${JSON.stringify(datos.error)}`);
    }
    return datos.features || [];
}

async function listarAdjuntos(urlCapa, token, objectId) {
    const url = `${urlCapa}/${objectId}/attachments?f=json&token=${token}`;
    const respuesta = await fetch(url);
    const datos = await respuesta.json();
    if (datos.error) {
        throw new Error(`Error listando adjuntos de OBJECTID ${objectId}: ${JSON.stringify(datos.error)}`);
    }
    return datos.attachmentInfos || [];
}

async function descargarAdjunto(urlCapa, token, objectId, attachmentId, nombreArchivo, dirDestino) {
    const url = `${urlCapa}/${objectId}/attachments/${attachmentId}?token=${token}`;
    const respuesta = await fetch(url);
    if (!respuesta.ok) {
        throw new Error(`Error descargando adjunto ${attachmentId} de OBJECTID ${objectId}: HTTP ${respuesta.status}`);
    }
    fs.mkdirSync(dirDestino, { recursive: true });
    const destino = path.join(dirDestino, nombreArchivo);
    const buffer = Buffer.from(await respuesta.arrayBuffer());
    fs.writeFileSync(destino, buffer);
    return destino;
}

module.exports = {
    generarToken,
    obtenerToken,
    buscarItemsPorTitulo,
    obtenerItem,
    resolverCapa,
    obtenerMetadatosCapa,
    contarFeatures,
    consultarFeaturesPagina,
    listarAdjuntos,
    descargarAdjunto
};
