require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rutasAuth = require('./auth');
const rutasAdmin = require('./admin');

const app = express();

app.use(cors({ origin: process.env.ORIGEN_PERMITIDO || '*' }));
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
