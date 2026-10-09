// Configuración común de acceso al backend de autenticación de BIDELAN.
// En producción, nginx hace proxy de /auth y /admin en visor.geospatiallab.xyz.
// En modo local (MODO_LOCAL=1 en backend/.env, http://localhost:4000) el
// backend sirve también estas páginas y la API va al mismo origen — así
// funciona aunque una red bloquee *.geospatiallab.xyz.
const urlProduccionAuth = 'https://visor.geospatiallab.xyz';
const esModoLocalBidelan = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const apiAuthUrl = esModoLocalBidelan ? location.origin : urlProduccionAuth;
const claveTokenAuth = 'bidelanToken';
