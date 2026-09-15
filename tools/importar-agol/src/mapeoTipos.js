const TIPOS_CAMPO_AGOL_A_PG = {
    esriFieldTypeString: 'text',
    esriFieldTypeSmallInteger: 'smallint',
    esriFieldTypeInteger: 'integer',
    esriFieldTypeSingle: 'real',
    esriFieldTypeDouble: 'double precision',
    esriFieldTypeDate: 'timestamptz',
    esriFieldTypeOID: 'integer',
    esriFieldTypeGUID: 'uuid',
    esriFieldTypeGlobalID: 'uuid'
};

const TIPOS_GEOMETRIA_AGOL_A_PG = {
    esriGeometryPoint: 'Point',
    esriGeometryMultipoint: 'MultiPoint',
    esriGeometryPolyline: 'MultiLineString',
    esriGeometryPolygon: 'MultiPolygon'
};

function tipoPgParaCampo(campoAgol) {
    return TIPOS_CAMPO_AGOL_A_PG[campoAgol.type] || 'text';
}

function tipoGeometriaPg(geometryType) {
    const tipo = TIPOS_GEOMETRIA_AGOL_A_PG[geometryType];
    if (!tipo) {
        throw new Error(`Tipo de geometria AGOL no soportado: ${geometryType}`);
    }
    return tipo;
}

function quitarAcentos(texto) {
    return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function sanitizarIdentificador(nombre) {
    let id = quitarAcentos(nombre)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_{2,}/g, '_');

    if (!id) {
        throw new Error(`No se pudo derivar un nombre de tabla valido a partir de "${nombre}"`);
    }
    if (/^[0-9]/.test(id)) {
        id = `c_${id}`;
    }
    if (id.length > 63) {
        id = id.slice(0, 63).replace(/_+$/, '');
    }
    return id;
}

module.exports = {
    tipoPgParaCampo,
    tipoGeometriaPg,
    sanitizarIdentificador
};
