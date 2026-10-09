require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
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

app.get('/health', function (req, res) {
    res.json({ estado: 'ok' });
});

app.use('/auth', rutasAuth);
app.use('/admin', rutasAdmin);
app.use('/edicion', rutasEdicion);
app.use('/adjuntos', rutasAdjuntos);

// Modo local (MODO_LOCAL=1 en backend/.env): el backend sirve también el
// frontend en http://localhost:<PORT>, para trabajar sin pasar por el
// dominio público — útil si una red (p. ej. el filtro web corporativo de
// Panda) bloquea *.geospatiallab.xyz. Solo carpetas/páginas públicas, nunca
// backend/. En el servidor de producción, MODO_LOCAL debe quedar vacío.
if (process.env.MODO_LOCAL === '1') {
    const raiz = path.join(__dirname, '..');

    ['css', 'js', 'img'].forEach(function (carpeta) {
        app.use('/' + carpeta, express.static(path.join(raiz, carpeta)));
    });

    ['index.html', 'login.html', 'admin.html'].forEach(function (pagina) {
        app.get('/' + pagina, function (req, res) {
            res.sendFile(path.join(raiz, pagina));
        });
    });

    app.get('/', function (req, res) {
        res.redirect('/index.html');
    });
}

const puerto = process.env.PORT || 4000;

asegurarAdminInicial()
    .catch(function (error) {
        console.error('No se ha podido preparar la cuenta admin inicial:', error);
    })
    .then(function () {
        app.listen(puerto, function () {
            console.log(`Backend de autenticación escuchando en el puerto ${puerto}`);
            if (process.env.MODO_LOCAL === '1') {
                console.log(`Modo local: abre http://localhost:${puerto}/login.html`);
            }
        });
    });
