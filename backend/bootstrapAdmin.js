const bcrypt = require('bcryptjs');
const pool = require('./db');

const RONDAS_SAL = 10;

// Si ADMIN_EMAIL/ADMIN_PASSWORD están definidos, garantiza que esa cuenta
// exista y tenga rol admin + aprobada. Así siempre hay alguien capaz de
// aprobar las altas siguientes, sin depender de un UPDATE manual en la BD.
// Deja las variables vacías para desactivar este paso (p. ej. una vez que
// ya tengas admins gestionados a mano).
async function asegurarAdminInicial() {
    const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) {
        console.log('ADMIN_EMAIL/ADMIN_PASSWORD no configurados: se omite el bootstrap de admin.');
        return;
    }

    const existente = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);

    if (existente.rows.length > 0) {
        await pool.query(
            "UPDATE usuarios SET rol = 'admin', aprobado = true WHERE id = $1",
            [existente.rows[0].id]
        );
        console.log(`Cuenta admin asegurada (ya existía): ${email}`);
        return;
    }

    const nombre = (process.env.ADMIN_NOMBRE || 'Administrador').trim();
    const passwordHash = await bcrypt.hash(password, RONDAS_SAL);

    await pool.query(
        `INSERT INTO usuarios (nombre, email, password_hash, rol, aprobado)
         VALUES ($1, $2, $3, 'admin', true)`,
        [nombre, email, passwordHash]
    );

    console.log(`Cuenta admin creada: ${email}`);
}

module.exports = asegurarAdminInicial;
