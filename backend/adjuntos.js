const express = require('express');
const path = require('path');
const fs = require('fs');
const pool = require('./db');
const exigirUsuario = require('./middlewareUsuario');

const router = express.Router();

router.use(exigirUsuario);

// backend/ está un nivel por debajo de la raíz del proyecto (donde vive datos/).
const RAIZ_PROYECTO = path.join(__dirname, '..');
const RAIZ_ADJUNTOS = path.join(RAIZ_PROYECTO, 'datos', 'adjuntos');

router.get('/:tabla/:pk', manejarListar);
router.get('/:tabla/:pk/:idAdjunto', manejarDescargar);

/**
 * Reutiliza el registro de capas_editables como lista blanca de tablas
 * válidas, igual que edicion.js: nunca se interpola en SQL un nombre de
 * tabla que no haya pasado antes por aquí.
 */
async function buscarCapa(nombreTabla) {
    const resultado = await pool.query(
        'SELECT nombre_tabla FROM capas_editables WHERE nombre_tabla = $1 AND activa = true',
        [nombreTabla]
    );

    return resultado.rows[0] || null;
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
        res.sendFile(rutaAbsoluta);

    } catch (error) {
        console.error('Error al descargar adjunto:', error);
        res.status(500).json({ mensaje: 'No se ha podido descargar el adjunto.' });
    }
}

module.exports = router;
