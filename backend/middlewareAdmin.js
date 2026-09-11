const jwt = require('jsonwebtoken');

/**
 * Exige un JWT válido perteneciente a un usuario con rol "admin"
 * en la cabecera Authorization: Bearer <token>.
 */
function exigirAdmin(req, res, next) {
    const cabeceraAuth = req.headers.authorization || '';
    const token = cabeceraAuth.startsWith('Bearer ') ? cabeceraAuth.slice(7) : null;

    if (!token) {
        return res.status(401).json({ mensaje: 'Falta el token de acceso.' });
    }

    try {
        const datosToken = jwt.verify(token, process.env.JWT_SECRETO);

        if (datosToken.rol !== 'admin') {
            return res.status(403).json({ mensaje: 'No tienes permisos de administrador.' });
        }

        req.usuario = datosToken;
        next();

    } catch (error) {
        res.status(401).json({ mensaje: 'Token inválido o caducado.' });
    }
}

module.exports = exigirAdmin;
