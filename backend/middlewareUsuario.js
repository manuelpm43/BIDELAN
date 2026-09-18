const jwt = require('jsonwebtoken');

/**
 * Exige un JWT válido en la cabecera Authorization: Bearer <token>,
 * sin importar el rol (cualquier usuario con sesión iniciada). Como el
 * login ya comprueba "aprobado" antes de emitir el token, un token
 * válido implica una cuenta aprobada.
 */
function exigirUsuario(req, res, next) {
    const cabeceraAuth = req.headers.authorization || '';
    const token = cabeceraAuth.startsWith('Bearer ') ? cabeceraAuth.slice(7) : null;

    if (!token) {
        return res.status(401).json({ mensaje: 'Falta el token de acceso.' });
    }

    try {
        req.usuario = jwt.verify(token, process.env.JWT_SECRETO);
        next();

    } catch (error) {
        res.status(401).json({ mensaje: 'Token inválido o caducado.' });
    }
}

module.exports = exigirUsuario;
