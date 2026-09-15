async function tablaExiste(pool, schema, tabla) {
    const r = await pool.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`,
        [schema, tabla]
    );
    return r.rowCount > 0;
}

async function eliminarTablaSiExiste(pool, schema, tabla) {
    await pool.query(`DROP TABLE IF EXISTS ${schema}.${tabla}_adjuntos`);
    await pool.query(`DROP TABLE IF EXISTS ${schema}.${tabla}`);
}

async function crearTabla(pool, schema, tabla, columnas, tipoGeometria) {
    const defsColumnas = columnas.map(c => `"${c.nombrePg}" ${c.tipoPg}`);
    let sql = `CREATE TABLE ${schema}.${tabla} (\n  objectid_agol integer PRIMARY KEY`;
    if (defsColumnas.length) {
        sql += `,\n  ${defsColumnas.join(',\n  ')}`;
    }
    if (tipoGeometria) {
        sql += `,\n  geom geometry(${tipoGeometria}, 3857)`;
    }
    sql += `\n)`;
    await pool.query(sql);
    if (tipoGeometria) {
        await pool.query(`CREATE INDEX "${tabla}_geom_idx" ON ${schema}.${tabla} USING GIST (geom)`);
    }
}

async function crearTablaAdjuntos(pool, schema, tabla) {
    await pool.query(`
        CREATE TABLE ${schema}.${tabla}_adjuntos (
            id serial PRIMARY KEY,
            feature_objectid integer NOT NULL REFERENCES ${schema}.${tabla}(objectid_agol),
            nombre_archivo text NOT NULL,
            ruta_relativa text NOT NULL,
            tipo_contenido text,
            tamano_bytes bigint
        )
    `);
}

async function insertarFeaturesPagina(pool, schema, tabla, columnas, campoObjectId, tipoGeometria, features) {
    if (features.length === 0) return;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const nombresCol = ['objectid_agol', ...columnas.map(c => `"${c.nombrePg}"`)];
        if (tipoGeometria) nombresCol.push('geom');

        const filas = [];
        const parametros = [];
        let n = 1;

        for (const feature of features) {
            const props = feature.properties || {};
            const placeholders = [`$${n++}`];
            parametros.push(props[campoObjectId]);

            for (const col of columnas) {
                placeholders.push(`$${n++}`);
                parametros.push(props[col.nombreAgol] ?? null);
            }

            if (tipoGeometria) {
                if (feature.geometry) {
                    const esMulti = tipoGeometria.startsWith('Multi');
                    const expr = esMulti
                        ? `ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($${n}), 3857))`
                        : `ST_SetSRID(ST_GeomFromGeoJSON($${n}), 3857)`;
                    placeholders.push(expr);
                    parametros.push(JSON.stringify(feature.geometry));
                    n++;
                } else {
                    placeholders.push('NULL');
                }
            }

            filas.push(`(${placeholders.join(', ')})`);
        }

        const sql = `
            INSERT INTO ${schema}.${tabla} (${nombresCol.join(', ')})
            VALUES ${filas.join(', ')}
            ON CONFLICT (objectid_agol) DO NOTHING
        `;
        await client.query(sql, parametros);
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function insertarAdjunto(pool, schema, tabla, adjunto) {
    await pool.query(
        `INSERT INTO ${schema}.${tabla}_adjuntos
            (feature_objectid, nombre_archivo, ruta_relativa, tipo_contenido, tamano_bytes)
         VALUES ($1, $2, $3, $4, $5)`,
        [adjunto.featureObjectId, adjunto.nombreArchivo, adjunto.rutaRelativa, adjunto.tipoContenido, adjunto.tamanoBytes]
    );
}

async function asegurarTablaAuditoria(pool, schema) {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.capas_importadas_agol (
            nombre_tabla text PRIMARY KEY,
            agol_item_id text NOT NULL,
            agol_titulo text NOT NULL,
            tipo_geometria text,
            num_features integer,
            tiene_adjuntos boolean,
            fecha_importacion timestamptz NOT NULL DEFAULT now()
        )
    `);
}

async function registrarAuditoria(pool, schema, registro) {
    await pool.query(
        `INSERT INTO ${schema}.capas_importadas_agol
            (nombre_tabla, agol_item_id, agol_titulo, tipo_geometria, num_features, tiene_adjuntos, fecha_importacion)
         VALUES ($1, $2, $3, $4, $5, $6, now())
         ON CONFLICT (nombre_tabla) DO UPDATE SET
            agol_item_id = EXCLUDED.agol_item_id,
            agol_titulo = EXCLUDED.agol_titulo,
            tipo_geometria = EXCLUDED.tipo_geometria,
            num_features = EXCLUDED.num_features,
            tiene_adjuntos = EXCLUDED.tiene_adjuntos,
            fecha_importacion = now()`,
        [registro.nombreTabla, registro.itemId, registro.titulo, registro.tipoGeometria, registro.numFeatures, registro.tieneAdjuntos]
    );
}

module.exports = {
    tablaExiste,
    eliminarTablaSiExiste,
    crearTabla,
    crearTablaAdjuntos,
    insertarFeaturesPagina,
    insertarAdjunto,
    asegurarTablaAuditoria,
    registrarAuditoria
};
