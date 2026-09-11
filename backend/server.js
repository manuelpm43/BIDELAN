require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rutasAuth = require('./auth');
const rutasAdmin = require('./admin');

const app = express();

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

const puerto = process.env.PORT || 4000;

app.listen(puerto, function () {
    console.log(`Backend de autenticación escuchando en el puerto ${puerto}`);
});
