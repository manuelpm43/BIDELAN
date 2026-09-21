const express = require('express');
const path = require('path');
const fs = require('fs');
const pool = require('./db');
const exigirUsuario = require('./middlewareUsuario');
const exigirEditor = require('./middlewareEditor');

const router = express.Router();

router.use(exigirUsuario);

// backend/ está un nivel por debajo de la raíz del proyecto (donde vive datos/).
const RAIZ_PROYECTO = path.join(__dirname, '..');
const RAIZ_ADJUNTOS = path.join(RAIZ_PROYECTO, 'datos', 'adjuntos');

const TAMANO_MAXIMO_ADJUNTO = '15mb';
const TIPOS_ADJUNTO_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

router.get('/:tabla/:pk', manejarListar);
router.get('/:tabla/:pk/:idAdjunto', manejarDescargar);
// El archivo llega como cuerpo binario directo (sin multipart): un archivo por petición.
router.post(
    '/:tabla/:pk',
    exigirEditor,
    express.raw({ type: function () { return true; }, limit: TAMANO_MAXIMO_ADJUNTO }),
    manejarSubir
);

/**
 * Reutiliza el registro de capas_editables como lista blanca de tablas
 * válidas, igual que edicion.js: nunca se interpola en SQL un nombre de
 * tabla que no haya pasado antes por aquí.
 */
async function buscarCapa(nombreTabla) {
    const resultado = await pool.query(
        'SELECT nombre_tabla, campo_pk FROM capas_editables WHERE nombre_tabla = $1 AND activa = true',
        [nombreTabla]
    );

    return resultado.rows[0] || null;
}

function limpiarNombreArchivo(nombre) {
    const base = path.basename(String(nombre || 'adjunto'));

    return base.replace(/[^\w.\-() ]/g, '_').slice(-100) || 'adjunto';
}

async function tablaAdjuntosExiste(nombreTablaAdjuntos) {
    const resultado = await pool.query(
        `SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = $1
        ) AS existe`,
        [nombreTablaAdjuntos]
    );

    return resultado.rows[0].existe;
}

async function manejarListar(req, res) {
    const { tabla, pk } = req.params;

    try {
        const capa = await buscarCapa(tabla);

        if (!capa) {
            return res.status(404).json({ mensaje: 'Esa capa no existe.' });
        }

        const tablaAdjuntos = `${capa.nombre_tabla}_adjuntos`;

        if (!(await tablaAdjuntosExiste(tablaAdjuntos))) {
            return res.json([]);
        }

        const resultado = await pool.query(
            `SELECT id, nombre_archivo, tipo_contenido, tamano_bytes
             FROM public."${tablaAdjuntos}"
             WHERE feature_objectid = $1
             ORDER BY id`,
            [pk]
        );

        res.json(resultado.rows);

    } catch (error) {
        console.error('Error al listar adjuntos:', error);
        res.status(500).json({ mensaje: 'No se han podido obtener los adjuntos.' });
    }
}

async function manejarDescargar(req, res) {
    const { tabla, pk, idAdjunto } = req.params;

    try {
        const capa = await buscarCapa(tabla);

        if (!capa) {
            return res.status(404).json({ mensaje: 'Esa capa no existe.' });
        }

        const tablaAdjuntos = `${capa.nombre_tabla}_adjuntos`;

        if (!(await tablaAdjuntosExiste(tablaAdjuntos))) {
            return res.status(404).json({ mensaje: 'Esa capa no tiene adjuntos.' });
        }

        const resultado = await pool.query(
            `SELECT ruta_relativa, tipo_contenido
             FROM public."${tablaAdjuntos}"
             WHERE id = $1 AND feature_objectid = $2`,
            [idAdjunto, pk]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({ mensaje: 'No existe ese adjunto.' });
        }

        const adjunto = resultado.rows[0];
        const rutaAbsoluta = path.resolve(RAIZ_PROYECTO, adjunto.ruta_relativa);

        // Protección extra frente a path traversal, aunque ruta_relativa
        // solo la escribe hoy tools/importar-agol, no el cliente.
        if (!rutaAbsoluta.startsWith(RAIZ_ADJUNTOS + path.sep)) {
            return res.status(403).json({ mensaje: 'Ruta de adjunto no válida.' });
        }

        if (!fs.existsSync(rutaAbsoluta)) {
            return res.status(404).json({ mensaje: 'El archivo ya no existe en el servidor.' });
        }

        res.setHeader('Content-Type', adjunto.tipo_contenido || 'application/octet-stream');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.sendFile(rutaAbsoluta);

    } catch (error) {
        console.error('Error al descargar adjunto:', error);
        res.status(500).json({ mensaje: 'No se ha podido descargar el adjunto.' });
    }
}

async function manejarSubir(req, res) {
    const { tabla, pk } = req.params;
    const tipoContenido = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();

    if (!/^\d+$/.test(pk)) {
        return res.status(400).json({ mensaje: 'Identificador no válido.' });
    }

    if (!TIPOS_ADJUNTO_PERMITIDOS.includes(tipoContenido)) {
        return res.status(415).json({ mensaje: 'Solo se admiten imágenes (JPG, PNG, WEBP, GIF) y PDF.' });
    }

    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ mensaje: 'No se ha recibido ningún archivo.' });
    }

    let rutaAbsoluta = null;

    try {
        const capa = await buscarCapa(tabla);

        if (!capa) {
            return res.status(404).json({ mensaje: 'Esa capa no existe.' });
        }

        const tablaAdjuntos = `${capa.nombre_tabla}_adjuntos`;

        if (!(await tablaAdjuntosExiste(tablaAdjuntos))) {
            return res.status(404).json({ mensaje: 'Esa capa no admite adjuntos.' });
        }

        const existe = await pool.query(
            `SELECT 1 FROM public."${capa.nombre_tabla}" WHERE "${capa.campo_pk}" = $1`,
            [pk]
        );

        if (existe.rows.length === 0) {
            return res.status(404).json({ mensaje: 'No existe ningún elemento con ese identificador.' });
        }

        const nombreArchivo = limpiarNombreArchivo(req.query.nombre);
        const carpeta = path.join(RAIZ_ADJUNTOS, capa.nombre_tabla, pk);
        const nombreEnDisco = `${Date.now()}-${nombreArchivo}`;

        rutaAbsoluta = path.join(carpeta, nombreEnDisco);
        await fs.promises.mkdir(carpeta, { recursive: true });
        await fs.promises.writeFile(rutaAbsoluta, req.body);

        const rutaRelativa = ['datos', 'adjuntos', capa.nombre_tabla, pk, nombreEnDisco].join('/');

        const resultado = await pool.query(
            `INSERT INTO public."${tablaAdjuntos}" (feature_objectid, nombre_archivo, ruta_relativa, tipo_contenido, tamano_bytes)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, nombre_archivo, tipo_contenido, tamano_bytes`,
            [pk, nombreArchivo, rutaRelativa, tipoContenido, req.body.length]
        );

        await pool.query(
            `INSERT INTO auditoria_edicion (tabla, operacion, feature_pk, usuario_id, usuario_email, datos_antes, datos_despues)
             VALUES ($1, 'adjuntar', $2, $3, $4, NULL, $5)`,
            [
                capa.nombre_tabla,
                pk,
                req.usuario.id,
                req.usuario.email,
                JSON.stringify({ nombre_archivo: nombreArchivo, tamano_bytes: req.body.length })
            ]
        );

        res.status(201).json(resultado.rows[0]);

    } catch (error) {
        console.error('Error al subir adjunto:', error);

        if (rutaAbsoluta) {
            fs.promises.unlink(rutaAbsoluta).catch(function () {});
        }

        res.status(500).json({ mensaje: 'No se ha podido subir el adjunto.' });
    }
}

module.exports = router;
