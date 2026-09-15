const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const pool = require('./db');

const router = express.Router();

const RONDAS_SAL = 10;
const PATRON_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const limitadorAuth = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { mensaje: 'Demasiados intentos. Inténtalo de nuevo más tarde.' }
});

router.use(limitadorAuth);

router.post('/register', manejarRegistro);
router.post('/login', manejarLogin);

function normalizarEmail(email) {
    return (email || '').trim().toLowerCase();
}

async function manejarRegistro(req, res) {
    const nombre = (req.body.nombre || '').trim();
    const email = normalizarEmail(req.body.email);
    const { password } = req.body;

    if (!nombre || !email || !password) {
        return res.status(400).json({ mensaje: 'Rellena todos los campos.' });
    }

    if (!PATRON_EMAIL.test(email)) {
        return res.status(400).json({ mensaje: 'Introduce un correo electrónico válido.' });
    }

    if (password.length < 6) {
        return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    try {
        const existente = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);

        if (existente.rows.length > 0) {
            return res.status(409).json({ mensaje: 'Ya existe una cuenta con ese correo electrónico.' });
        }

        const passwordHash = await bcrypt.hash(password, RONDAS_SAL);

        await pool.query(
            'INSERT INTO usuarios (nombre, email, password_hash) VALUES ($1, $2, $3)',
            [nombre, email, passwordHash]
        );

        res.status(201).json({
            mensaje: 'Registro recibido. Un administrador debe aprobar tu cuenta antes de que puedas iniciar sesión.'
        });

    } catch (error) {
        console.error('Error al registrar usuario:', error);
        res.status(500).json({ mensaje: 'No se ha podido completar el registro.' });
    }
}

async function manejarLogin(req, res) {
    const email = normalizarEmail(req.body.email);
    const { password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ mensaje: 'Introduce correo electrónico y contraseña.' });
    }

    try {
        const resultado = await pool.query(
            'SELECT id, email, password_hash, rol, aprobado FROM usuarios WHERE email = $1',
            [email]
        );

        const usuario = resultado.rows[0];

        if (!usuario) {
            return res.status(401).json({ mensaje: 'Correo electrónico o contraseña incorrectos.' });
        }

        const passwordValida = await bcrypt.compare(password, usuario.password_hash);

        if (!passwordValida) {
            return res.status(401).json({ mensaje: 'Correo electrónico o contraseña incorrectos.' });
        }

        if (!usuario.aprobado) {
            return res.status(403).json({ mensaje: 'Tu cuenta está pendiente de aprobación por un administrador.' });
        }

        const token = generarToken(usuario);

        res.json({ token });

    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        res.status(500).json({ mensaje: 'No se ha podido iniciar sesión.' });
    }
}

function generarToken(usuario) {
    return jwt.sign(
        { id: usuario.id, email: usuario.email, rol: usuario.rol },
        process.env.JWT_SECRETO,
        { expiresIn: process.env.JWT_EXPIRA_EN || '7d' }
    );
}

module.exports = router;
