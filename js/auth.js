// Base de la API de autenticación. Vacío = mismo origen que sirve esta página.
const apiAuthUrl = '';

const claveTokenAuth = 'bidelanToken';

// Modo de prueba: simula /auth/login y /auth/register en localStorage mientras no exista backend real.
// Poner a false en cuanto la API de autenticación esté disponible.
const modoMockAuth = true;
const claveUsuariosMock = 'bidelanUsuariosMock';

document.addEventListener('DOMContentLoaded', function () {
    inicializarPestanasAuth();
    inicializarFormularioLogin();
    inicializarFormularioRegistro();
    inicializarAvisoMockAuth();
});

function inicializarAvisoMockAuth() {
    const avisoMockAuth = document.getElementById('avisoMockAuth');
    avisoMockAuth.classList.toggle('oculto', !modoMockAuth);
}

function inicializarPestanasAuth() {
    const btnPestanaLogin = document.getElementById('btnPestanaLogin');
    const btnPestanaRegistro = document.getElementById('btnPestanaRegistro');

    btnPestanaLogin.addEventListener('click', function () {
        cambiarPestanaAuth('login');
    });

    btnPestanaRegistro.addEventListener('click', function () {
        cambiarPestanaAuth('registro');
    });
}

function cambiarPestanaAuth(pestana) {
    const btnPestanaLogin = document.getElementById('btnPestanaLogin');
    const btnPestanaRegistro = document.getElementById('btnPestanaRegistro');
    const formularioLogin = document.getElementById('formularioLogin');
    const formularioRegistro = document.getElementById('formularioRegistro');

    const esLogin = pestana === 'login';

    btnPestanaLogin.classList.toggle('activa', esLogin);
    btnPestanaRegistro.classList.toggle('activa', !esLogin);
    formularioLogin.classList.toggle('oculto', !esLogin);
    formularioRegistro.classList.toggle('oculto', esLogin);
}

function inicializarFormularioLogin() {
    const formularioLogin = document.getElementById('formularioLogin');

    formularioLogin.addEventListener('submit', function (evento) {
        evento.preventDefault();
        iniciarSesion();
    });
}

function inicializarFormularioRegistro() {
    const formularioRegistro = document.getElementById('formularioRegistro');

    formularioRegistro.addEventListener('submit', function (evento) {
        evento.preventDefault();
        registrarUsuario();
    });
}

function iniciarSesion() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const btnSubmit = document.getElementById('btnSubmitLogin');

    limpiarMensajeAuth('mensajeLogin');

    if (!email || !password) {
        mostrarMensajeAuth('mensajeLogin', 'Introduce correo electrónico y contraseña.', 'error');
        return;
    }

    btnSubmit.disabled = true;

    peticionAuth('/auth/login', { email: email, password: password })
        .then(function (datos) {
            if (!datos.token) {
                throw new Error('El servidor no ha devuelto un token de acceso.');
            }
            guardarTokenYRedirigirAlVisor(datos.token);
        })
        .catch(function (error) {
            mostrarMensajeAuth('mensajeLogin', error.message, 'error');
        })
        .finally(function () {
            btnSubmit.disabled = false;
        });
}

function registrarUsuario() {
    const nombre = document.getElementById('registroNombre').value.trim();
    const email = document.getElementById('registroEmail').value.trim();
    const password = document.getElementById('registroPassword').value;
    const passwordConfirmar = document.getElementById('registroPasswordConfirmar').value;
    const btnSubmit = document.getElementById('btnSubmitRegistro');

    limpiarMensajeAuth('mensajeRegistro');

    if (!nombre || !email || !password || !passwordConfirmar) {
        mostrarMensajeAuth('mensajeRegistro', 'Rellena todos los campos.', 'error');
        return;
    }

    if (password.length < 6) {
        mostrarMensajeAuth('mensajeRegistro', 'La contraseña debe tener al menos 6 caracteres.', 'error');
        return;
    }

    if (password !== passwordConfirmar) {
        mostrarMensajeAuth('mensajeRegistro', 'Las contraseñas no coinciden.', 'error');
        return;
    }

    btnSubmit.disabled = true;

    peticionAuth('/auth/register', { nombre: nombre, email: email, password: password })
        .then(function (datos) {
            if (datos.token) {
                guardarTokenYRedirigirAlVisor(datos.token);
                return;
            }
            mostrarMensajeAuth('mensajeRegistro', 'Cuenta creada correctamente. Ya puedes iniciar sesión.', 'exito');
            document.getElementById('formularioRegistro').reset();
            cambiarPestanaAuth('login');
        })
        .catch(function (error) {
            mostrarMensajeAuth('mensajeRegistro', error.message, 'error');
        })
        .finally(function () {
            btnSubmit.disabled = false;
        });
}

function peticionAuth(ruta, cuerpo) {
    if (modoMockAuth) {
        return simularPeticionAuth(ruta, cuerpo);
    }

    return fetch(apiAuthUrl + ruta, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo)
    })
        .then(function (respuesta) {
            return respuesta.json()
                .catch(function () {
                    return {};
                })
                .then(function (datos) {
                    if (!respuesta.ok) {
                        throw new Error(datos.mensaje || datos.error || 'No se ha podido completar la operación.');
                    }
                    return datos;
                });
        })
        .catch(function (error) {
            if (error instanceof TypeError) {
                throw new Error('No se ha podido conectar con el servidor.');
            }
            throw error;
        });
}

function guardarTokenYRedirigirAlVisor(token) {
    localStorage.setItem(claveTokenAuth, token);
    window.location.href = 'index.html';
}

function mostrarMensajeAuth(idMensaje, texto, tipo) {
    const elementoMensaje = document.getElementById(idMensaje);
    elementoMensaje.textContent = texto;
    elementoMensaje.classList.remove('error', 'exito');
    elementoMensaje.classList.add(tipo);
}

function limpiarMensajeAuth(idMensaje) {
    const elementoMensaje = document.getElementById(idMensaje);
    elementoMensaje.textContent = '';
    elementoMensaje.classList.remove('error', 'exito');
}

// ---------------------------------------------------------------------
// MOCK de /auth/login y /auth/register (solo mientras no haya backend real)
// ---------------------------------------------------------------------

function simularPeticionAuth(ruta, cuerpo) {
    return new Promise(function (resolve, reject) {
        setTimeout(function () {
            try {
                if (ruta === '/auth/login') {
                    resolve(simularLogin(cuerpo));
                } else if (ruta === '/auth/register') {
                    resolve(simularRegistro(cuerpo));
                } else {
                    reject(new Error('Ruta de autenticación no soportada por el mock.'));
                }
            } catch (error) {
                reject(error);
            }
        }, 400);
    });
}

function simularLogin(cuerpo) {
    const usuarios = leerUsuariosMock();
    const usuario = usuarios.find(function (u) {
        return u.email === cuerpo.email;
    });

    if (!usuario || usuario.password !== cuerpo.password) {
        throw new Error('Correo electrónico o contraseña incorrectos.');
    }

    return { token: generarTokenMock(usuario.email) };
}

function simularRegistro(cuerpo) {
    const usuarios = leerUsuariosMock();
    const yaExiste = usuarios.some(function (u) {
        return u.email === cuerpo.email;
    });

    if (yaExiste) {
        throw new Error('Ya existe una cuenta con ese correo electrónico.');
    }

    usuarios.push({ nombre: cuerpo.nombre, email: cuerpo.email, password: cuerpo.password });
    guardarUsuariosMock(usuarios);

    return { token: generarTokenMock(cuerpo.email) };
}

function leerUsuariosMock() {
    try {
        return JSON.parse(localStorage.getItem(claveUsuariosMock)) || [];
    } catch (error) {
        return [];
    }
}

function guardarUsuariosMock(usuarios) {
    localStorage.setItem(claveUsuariosMock, JSON.stringify(usuarios));
}

function generarTokenMock(email) {
    return 'mock.' + btoa(email) + '.' + Date.now();
}
