const mensajeAdmin = document.getElementById('mensajeAdmin');
const tablaPendientes = document.getElementById('tablaPendientes');
const cuerpoTablaPendientes = document.getElementById('cuerpoTablaPendientes');
const textoSinPendientes = document.getElementById('textoSinPendientes');
const btnRecargarPendientes = document.getElementById('btnRecargarPendientes');

const mensajeUsuarios = document.getElementById('mensajeUsuarios');
const tablaUsuarios = document.getElementById('tablaUsuarios');
const cuerpoTablaUsuarios = document.getElementById('cuerpoTablaUsuarios');
const textoSinUsuarios = document.getElementById('textoSinUsuarios');
const btnRecargarUsuarios = document.getElementById('btnRecargarUsuarios');

const ROLES_DISPONIBLES = ['usuario', 'editor', 'admin'];

document.addEventListener('DOMContentLoaded', function () {

    const token = localStorage.getItem(claveTokenAuth);

    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    btnRecargarPendientes.addEventListener('click', cargarPendientes);
    btnRecargarUsuarios.addEventListener('click', cargarUsuarios);

    cargarPendientes();
    cargarUsuarios();

});

function cargarPendientes() {

    limpiarMensajeAdmin();

    peticionAdmin('/admin/usuarios/pendientes', 'GET')
        .then(function (pendientes) {
            pintarPendientes(pendientes);
        })
        .catch(function (error) {
            mostrarMensajeAdmin(error.message, 'error');
        });

}

function pintarPendientes(pendientes) {

    cuerpoTablaPendientes.innerHTML = '';

    if (pendientes.length === 0) {
        tablaPendientes.hidden = true;
        textoSinPendientes.hidden = false;
        return;
    }

    tablaPendientes.hidden = false;
    textoSinPendientes.hidden = true;

    pendientes.forEach(function (usuario) {

        const fila = document.createElement('tr');

        fila.innerHTML = `
            <td>${usuario.nombre}</td>
            <td>${usuario.email}</td>
            <td>${new Date(usuario.creado_en).toLocaleString('es-ES')}</td>
            <td class="celda-acciones"></td>
        `;

        const celdaAcciones = fila.querySelector('.celda-acciones');

        const btnAprobar = document.createElement('button');
        btnAprobar.type = 'button';
        btnAprobar.className = 'btn-accion-admin btn-aprobar';
        btnAprobar.textContent = 'Aprobar';
        btnAprobar.addEventListener('click', function () {
            gestionarUsuario(usuario.id, 'aprobar');
        });

        const btnRechazar = document.createElement('button');
        btnRechazar.type = 'button';
        btnRechazar.className = 'btn-accion-admin btn-rechazar';
        btnRechazar.textContent = 'Rechazar';
        btnRechazar.addEventListener('click', function () {
            gestionarUsuario(usuario.id, 'rechazar');
        });

        celdaAcciones.appendChild(btnAprobar);
        celdaAcciones.appendChild(btnRechazar);

        cuerpoTablaPendientes.appendChild(fila);

    });

}

function gestionarUsuario(id, accion) {

    limpiarMensajeAdmin();

    peticionAdmin(`/admin/usuarios/${id}/${accion}`, 'POST')
        .then(function (datos) {
            mostrarMensajeAdmin(datos.mensaje, 'exito');
            cargarPendientes();
        })
        .catch(function (error) {
            mostrarMensajeAdmin(error.message, 'error');
        });

}

function cargarUsuarios() {

    limpiarMensajeUsuarios();

    peticionAdmin('/admin/usuarios', 'GET')
        .then(function (usuarios) {
            pintarUsuarios(usuarios);
        })
        .catch(function (error) {
            mostrarMensajeUsuarios(error.message, 'error');
        });

}

function pintarUsuarios(usuarios) {

    cuerpoTablaUsuarios.innerHTML = '';

    if (usuarios.length === 0) {
        tablaUsuarios.hidden = true;
        textoSinUsuarios.hidden = false;
        return;
    }

    tablaUsuarios.hidden = false;
    textoSinUsuarios.hidden = true;

    usuarios.forEach(function (usuario) {

        const fila = document.createElement('tr');

        fila.innerHTML = `
            <td>${usuario.nombre}</td>
            <td>${usuario.email}</td>
            <td class="celda-rol"></td>
        `;

        const celdaRol = fila.querySelector('.celda-rol');

        const selectorRol = document.createElement('select');
        selectorRol.className = 'selector-rol';

        ROLES_DISPONIBLES.forEach(function (rol) {
            const opcion = document.createElement('option');
            opcion.value = rol;
            opcion.textContent = rol;
            opcion.selected = rol === usuario.rol;
            selectorRol.appendChild(opcion);
        });

        selectorRol.addEventListener('change', function () {
            cambiarRolUsuario(usuario.id, selectorRol.value);
        });

        celdaRol.appendChild(selectorRol);

        cuerpoTablaUsuarios.appendChild(fila);

    });

}

function cambiarRolUsuario(id, rol) {

    limpiarMensajeUsuarios();

    peticionAdmin(`/admin/usuarios/${id}/rol`, 'PATCH', { rol: rol })
        .then(function (datos) {
            mostrarMensajeUsuarios(datos.mensaje, 'exito');
        })
        .catch(function (error) {
            mostrarMensajeUsuarios(error.message, 'error');
            cargarUsuarios();
        });

}

function mostrarMensajeUsuarios(texto, tipo) {
    mensajeUsuarios.textContent = texto;
    mensajeUsuarios.classList.remove('error', 'exito');
    mensajeUsuarios.classList.add(tipo);
}

function limpiarMensajeUsuarios() {
    mensajeUsuarios.textContent = '';
    mensajeUsuarios.classList.remove('error', 'exito');
}

function peticionAdmin(ruta, metodo, cuerpo) {

    const token = localStorage.getItem(claveTokenAuth);
    const opciones = {
        method: metodo,
        headers: { 'Authorization': 'Bearer ' + token }
    };

    if (cuerpo) {
        opciones.headers['Content-Type'] = 'application/json';
        opciones.body = JSON.stringify(cuerpo);
    }

    return fetch(apiAuthUrl + ruta, opciones)
        .then(function (respuesta) {

            if (respuesta.status === 401 || respuesta.status === 403) {
                throw new Error('No tienes permisos de administrador para ver esta página.');
            }

            return respuesta.json()
                .catch(function () {
                    return {};
                })
                .then(function (datos) {
                    if (!respuesta.ok) {
                        throw new Error(datos.mensaje || 'No se ha podido completar la operación.');
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

function mostrarMensajeAdmin(texto, tipo) {
    mensajeAdmin.textContent = texto;
    mensajeAdmin.classList.remove('error', 'exito');
    mensajeAdmin.classList.add(tipo);
}

function limpiarMensajeAdmin() {
    mensajeAdmin.textContent = '';
    mensajeAdmin.classList.remove('error', 'exito');
}
