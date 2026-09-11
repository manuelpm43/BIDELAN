const express = require('express');
const pool = require('./db');
const exigirAdmin = require('./middlewareAdmin');

const router = express.Router();

router.use(exigirAdmin);

router.get('/usuarios/pendientes', manejarListarPendientes);
router.post('/usuarios/:id/aprobar', manejarAprobar);
router.post('/usuarios/:id/rechazar', manejarRechazar);

async function manejarListarPendientes(req, res) {
    try {
        const resultado = await pool.query(
            'SELECT id, nombre, email, creado_en FROM usuarios WHERE aprobado = false ORDER BY creado_en ASC'
        );

        res.json(resultado.rows);

    } catch (error) {
        console.error('Error al listar usuarios pendientes:', error);
        res.status(500).json({ mensaje: 'No se ha podido obtener la lista de pendientes.' });
    }
}

async function manejarAprobar(req, res) {
    const { id } = req.params;

    try {
        const resultado = await pool.query(
            'UPDATE usuarios SET aprobado = true WHERE id = $1 AND aprobado = false RETURNING id',
            [id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({ mensaje: 'No hay ninguna alta pendiente con ese id.' });
        }

        res.json({ mensaje: 'Usuario aprobado.' });

    } catch (error) {
        console.error('Error al aprobar usuario:', error);
        res.status(500).json({ mensaje: 'No se ha podido aprobar el usuario.' });
    }
}

async function manejarRechazar(req, res) {
    const { id } = req.params;

    try {
        const resultado = await pool.query(
            'DELETE FROM usuarios WHERE id = $1 AND aprobado = false RETURNING id',
            [id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({ mensaje: 'No hay ninguna alta pendiente con ese id.' });
        }

        res.json({ mensaje: 'Alta rechazada y eliminada.' });

    } catch (error) {
        console.error('Error al rechazar usuario:', error);
        res.status(500).json({ mensaje: 'No se ha podido rechazar el usuario.' });
    }
}

module.exports = router;
