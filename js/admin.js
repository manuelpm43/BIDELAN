const mensajeAdmin = document.getElementById('mensajeAdmin');
const tablaPendientes = document.getElementById('tablaPendientes');
const cuerpoTablaPendientes = document.getElementById('cuerpoTablaPendientes');
const textoSinPendientes = document.getElementById('textoSinPendientes');
const btnRecargarPendientes = document.getElementById('btnRecargarPendientes');

document.addEventListener('DOMContentLoaded', function () {

    const token = localStorage.getItem(claveTokenAuth);

    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    btnRecargarPendientes.addEventListener('click', cargarPendientes);

    cargarPendientes();

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

function peticionAdmin(ruta, metodo) {

    const token = localStorage.getItem(claveTokenAuth);

    return fetch(apiAuthUrl + ruta, {
        method: metodo,
        headers: { 'Authorization': 'Bearer ' + token }
    })
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
