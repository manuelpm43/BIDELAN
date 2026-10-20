// Configuración común de acceso al backend de autenticación de BIDELAN.
// En producción, nginx hace proxy de /auth y /admin en visor.geospatiallab.xyz.
// En modo local (MODO_LOCAL=1 en backend/.env) el propio backend sirve estas
// páginas y la API, siempre en el puerto 4000 — así funciona aunque una red
// bloquee *.geospatiallab.xyz. Importante: esto NO incluye abrir los ficheros
// con Live Server (puerto 5500) u otro servidor de ficheros estáticos — ahí
// no hay ninguna API escuchando, así que se sigue llamando a producción,
// igual que siempre.
const urlProduccionAuth = 'https://visor.geospatiallab.xyz';
const esBackendLocalBidelan = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    && location.port === '4000';
const apiAuthUrl = esBackendLocalBidelan ? location.origin : urlProduccionAuth;
const claveTokenAuth = 'bidelanToken';
