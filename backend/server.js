require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const rutasAuth = require('./auth');
const rutasAdmin = require('./admin');
const rutasEdicion = require('./edicion');
const rutasAdjuntos = require('./adjuntos');
const asegurarAdminInicial = require('./bootstrapAdmin');

const app = express();

// Necesario para que express-rate-limit vea la IP real del cliente
// cuando el backend está detrás de un proxy inverso (nginx, etc.)
app.set('trust proxy', 1);

// ORIGEN_PERMITIDO admite varios orígenes separados por comas
// (por ejemplo: http://localhost:5500,http://127.0.0.1:5500)
const origenesPermitidos = (process.env.ORIGEN_PERMITIDO || '*')
    .split(',')
    .map(function (origen) { return origen.trim(); });

app.use(cors({ origin: origenesPermitidos.includes('*') ? '*' : origenesPermitidos }));
app.use(express.json());

// Límite general para toda la API (además del límite más estricto propio
// de /auth): evita que /edicion/atributos (pública) o /edicion y /adjuntos
// (autenticadas, pero sin límite propio) se puedan martillear sin freno.
const limitadorGeneral = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { mensaje: 'Demasiadas peticiones. Inténtalo de nuevo en un momento.' }
});

app.use(limitadorGeneral);

app.get('/health', function (req, res) {
    res.json({ estado: 'ok' });
});

// La clave no es secreta de verdad (una API key de Maps JavaScript viaja
// siempre al navegador); se sirve desde aquí solo para no dejarla escrita
// en el repositorio. La protección real es la restricción por referente
// HTTP configurada en la consola de Google Cloud.
app.get('/config/google-maps-key', function (req, res) {
    res.json({ apiKey: process.env.GOOGLE_MAPS_API_KEY || null });
});

app.use('/auth', rutasAuth);
app.use('/admin', rutasAdmin);
app.use('/edicion', rutasEdicion);
app.use('/adjuntos', rutasAdjuntos);

const puerto = process.env.PORT || 4000;

asegurarAdminInicial()
    .catch(function (error) {
        console.error('No se ha podido preparar la cuenta admin inicial:', error);
    })
    .then(function () {
        app.listen(puerto, function () {
            console.log(`Backend de autenticación escuchando en el puerto ${puerto}`);
        });
    });
