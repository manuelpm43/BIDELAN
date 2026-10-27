require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const agol = require('./src/agol');
const postgres = require('./src/postgres');
const sftpUtil = require('./src/sftp');
const mapeoTipos = require('./src/mapeoTipos');
const geoserver = require('./src/geoserver');

function parsearArgs(argv) {
    const args = { simular: false, forzar: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--capa') args.capa = argv[++i];
        else if (a === '--item-id') args.itemId = argv[++i];
        else if (a === '--indice') args.indice = Number(argv[++i]);
        else if (a === '--limite') args.limite = Number(argv[++i]);
        else if (a === '--simular') args.simular = true;
        else if (a === '--forzar') args.forzar = true;
        else throw new Error(`Argumento no reconocido: ${a}. Usa --capa "<nombre>" [--item-id <id>] [--indice <n>] [--limite <n>] [--simular] [--forzar]`);
    }
    if (!args.capa && !args.itemId) {
        throw new Error('Debes indicar --capa "<nombre exacto en ArcGIS Online>" o --item-id <id>');
    }
    if (args.limite !== undefined && (!Number.isInteger(args.limite) || args.limite <= 0)) {
        throw new Error('--limite debe ser un numero entero mayor que 0');
    }
    return args;
}

// Fisher-Yates: elige "cantidad" elementos al azar, sin repetir, de toda la lista.
function elegirAlAzar(lista, cantidad) {
    const copia = lista.slice();
    for (let i = copia.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia.slice(0, cantidad);
}

function columnasDesdeMetadatos(metadatos, campoObjectId) {
    const campos = (metadatos.fields || []).filter(
        f => f.name !== campoObjectId && f.type !== 'esriFieldTypeGeometry'
    );

    const nombresUsados = new Set(['objectid_agol', 'geom']);
    return campos.map(f => {
        const base = mapeoTipos.sanitizarIdentificador(f.name);
        let candidato = base;
        let sufijo = 2;
        while (nombresUsados.has(candidato)) {
            candidato = `${base}_${sufijo}`;
            sufijo++;
        }
        nombresUsados.add(candidato);
        return { nombreAgol: f.name, nombrePg: candidato, tipoPg: mapeoTipos.tipoPgParaCampo(f) };
    });
}

async function main() {
    const cfg = process.env;
    const args = parsearArgs(process.argv.slice(2));
    const schema = cfg.PGSCHEMA || 'bidelan';

    console.log('Autenticando en ArcGIS Online...');
    const token = await agol.obtenerToken(cfg);

    let item;
    if (args.itemId) {
        item = await agol.obtenerItem(token, args.itemId);
    } else {
        const resultados = await agol.buscarItemsPorTitulo(token, args.capa);
        if (resultados.length === 0) {
            throw new Error(`No se encontro ningun elemento titulado "${args.capa}" en ${cfg.AGOL_ORG_URL}`);
        }
        if (resultados.length > 1) {
            const listado = resultados
                .map(r => `  - id ${r.id}  tipo ${r.type}  propietario ${r.owner}  modificado ${new Date(r.modified).toISOString()}`)
                .join('\n');
            throw new Error(`Hay ${resultados.length} elementos titulados "${args.capa}", vuelve a ejecutar con --item-id:\n${listado}`);
        }
        item = resultados[0];
    }
    console.log(`Elemento resuelto: "${item.title}" (${item.type}, id ${item.id})`);

    const { urlCapa } = await agol.resolverCapa(token, item, args.indice);
    const metadatos = await agol.obtenerMetadatosCapa(urlCapa, token);
    const totalFeatures = await agol.contarFeatures(urlCapa, token);
    const tieneAdjuntos = !!metadatos.hasAttachments;
    const campoObjectId = metadatos.objectIdField || 'OBJECTID';
    const tipoGeometria = metadatos.geometryType ? mapeoTipos.tipoGeometriaPg(metadatos.geometryType) : null;

    const columnas = columnasDesdeMetadatos(metadatos, campoObjectId);
    const nombreTabla = mapeoTipos.sanitizarIdentificador(item.title);

    let idsSeleccionados = null;
    if (args.limite) {
        console.log(`\n--limite ${args.limite}: consultando todos los OBJECTID para elegir una muestra al azar...`);
        const todosLosIds = await agol.consultarIdsCompletos(urlCapa, token);
        if (args.limite >= todosLosIds.length) {
            console.log(`Aviso: --limite ${args.limite} es >= al total (${todosLosIds.length}); se importaran todas las features.`);
            idsSeleccionados = todosLosIds;
        } else {
            idsSeleccionados = elegirAlAzar(todosLosIds, args.limite);
        }
    }
    const totalAImportar = idsSeleccionados ? idsSeleccionados.length : totalFeatures;

    console.log(`Tabla destino: ${schema}.${nombreTabla}`);
    console.log(`Geometria: ${tipoGeometria || '(sin geometria)'}   Features en origen: ${totalFeatures}` +
        (idsSeleccionados ? `   Se importaran (al azar): ${totalAImportar}` : '') +
        `   Adjuntos: ${tieneAdjuntos ? 'si' : 'no'}`);
    console.log('Columnas:');
    columnas.forEach(c => console.log(`  ${c.nombreAgol} -> ${c.nombrePg} (${c.tipoPg})`));

    if (args.simular) {
        if (idsSeleccionados) {
            console.log(`OBJECTID elegidos: ${idsSeleccionados.join(', ')}`);
        }
        console.log('\nModo --simular: no se ha escrito nada en Postgres ni se han descargado adjuntos.');
        return;
    }

    const pool = new Pool({
        host: cfg.PGHOST,
        port: cfg.PGPORT,
        database: cfg.PGDATABASE,
        user: cfg.PGUSER,
        password: cfg.PGPASSWORD,
        ssl: cfg.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false
    });

    let sftp = null;
    try {
        const existe = await postgres.tablaExiste(pool, schema, nombreTabla);
        if (existe && !args.forzar) {
            throw new Error(`La tabla ${schema}.${nombreTabla} ya existe. Vuelve a ejecutar con --forzar si quieres recrearla.`);
        }
        if (existe && args.forzar) {
            console.log('Eliminando tabla existente (--forzar)...');
            await postgres.eliminarTablaSiExiste(pool, schema, nombreTabla);
        }

        await postgres.asegurarTablaAuditoria(pool, schema);

        console.log('Creando tabla...');
        await postgres.crearTabla(pool, schema, nombreTabla, columnas, tipoGeometria);
        if (tieneAdjuntos) {
            await postgres.crearTablaAdjuntos(pool, schema, nombreTabla);
            console.log('Conectando por SFTP al servidor...');
            sftp = await sftpUtil.conectar(cfg);
        }

        console.log('Descargando e insertando features...');
        let insertados = 0;
        let totalAdjuntos = 0;

        async function procesarPagina(pagina) {
            if (pagina.length === 0) return;

            await postgres.insertarFeaturesPagina(pool, schema, nombreTabla, columnas, campoObjectId, tipoGeometria, pagina);
            insertados += pagina.length;
            console.log(`  features ${insertados}/${totalAImportar}`);

            if (tieneAdjuntos) {
                for (const feature of pagina) {
                    const objectId = feature.properties[campoObjectId];
                    const adjuntos = await agol.listarAdjuntos(urlCapa, token, objectId);
                    for (const adj of adjuntos) {
                        const dirTemp = path.join(__dirname, 'tmp', nombreTabla, String(objectId));
                        const localPath = await agol.descargarAdjunto(urlCapa, token, objectId, adj.id, adj.name, dirTemp);
                        const rutaRemota = `${cfg.ADJUNTOS_DIR_REMOTO}/${nombreTabla}/${objectId}/${adj.name}`;
                        await sftpUtil.subirArchivo(sftp, localPath, rutaRemota);
                        fs.unlinkSync(localPath);

                        const rutaRelativa = `${cfg.ADJUNTOS_RUTA_RELATIVA}/${nombreTabla}/${objectId}/${adj.name}`;
                        await postgres.insertarAdjunto(pool, schema, nombreTabla, {
                            featureObjectId: objectId,
                            nombreArchivo: adj.name,
                            rutaRelativa,
                            tipoContenido: adj.contentType,
                            tamanoBytes: adj.size
                        });
                        totalAdjuntos++;
                    }
                }
            }
        }

        if (idsSeleccionados) {
            // Muestra al azar (--limite): una sola consulta por OBJECTID, sin paginar.
            const pagina = await agol.consultarFeaturesPorIds(urlCapa, token, idsSeleccionados);
            await procesarPagina(pagina);
        } else {
            const TAMANO_PAGINA = 500;
            for (let offset = 0; offset < totalFeatures; offset += TAMANO_PAGINA) {
                const pagina = await agol.consultarFeaturesPagina(urlCapa, token, offset, TAMANO_PAGINA);
                if (pagina.length === 0) break;
                await procesarPagina(pagina);
            }
        }

        if (sftp) {
            await sftp.end();
            sftp = null;
        }
        const dirTemporalCapa = path.join(__dirname, 'tmp', nombreTabla);
        if (fs.existsSync(dirTemporalCapa)) {
            fs.rmSync(dirTemporalCapa, { recursive: true, force: true });
        }

        await postgres.registrarAuditoria(pool, schema, {
            nombreTabla,
            itemId: item.id,
            titulo: item.title,
            tipoGeometria: tipoGeometria || null,
            numFeatures: insertados,
            tieneAdjuntos
        });

        console.log(`\nImportacion completada: ${insertados} features, ${totalAdjuntos} adjuntos en ${schema}.${nombreTabla}`);

        if (geoserver.estaConfigurado(cfg)) {
            console.log('Publicando la capa en GeoServer...');
            try {
                const capaCompleta = await geoserver.publicarCapa(cfg, nombreTabla, {
                    titulo: item.title,
                    tieneGeometria: !!tipoGeometria
                });
                console.log(`Capa publicada en GeoServer: ${capaCompleta}`);
            } catch (error) {
                console.error(`Aviso: no se pudo publicar en GeoServer (${error.message}). Los datos ya estan en Postgres; publica la capa a mano si hace falta.`);
            }
        } else {
            console.log('GEOSERVER_* no configurado en .env: la capa se queda solo en Postgres, publicala a mano en GeoServer.');
        }
    } finally {
        if (sftp) await sftp.end();
        await pool.end();
    }
}

main().catch(error => {
    console.error('ERROR:', error.message);
    process.exit(1);
});
