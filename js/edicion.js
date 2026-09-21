// apiAuthUrl y claveTokenAuth se definen en js/config.js
//
// Si hay un token guardado (login previo desde login.html) y el backend
// confirma que el rol tiene permisos de edición, se activan los controles
// de edición. Si no, el visor se comporta exactamente igual que hasta
// ahora: nada nuevo visible, ni se hace ninguna petición extra.

window.capasEditablesActivas = {};

const CHECKBOX_POR_TABLA = {
    pk_v0: "checkPKv0",
    partes_accidentes: "checkPartesAccidentes"
};

document.addEventListener("DOMContentLoaded", function () {

    const token = localStorage.getItem(claveTokenAuth);

    if (!token) {
        return;
    }

    peticionEdicion("/edicion/capas", "GET")
        .then(function (capas) {

            capas.forEach(function (capa) {
                window.capasEditablesActivas[capa.nombre_tabla] = capa;
                anadirBotonColocarPunto(capa);
            });

        })
        .catch(function () {
            // Sin permisos de edición o token caducado: no se muestra nada nuevo.
        });

});


function anadirBotonColocarPunto(capa) {

    if (capa.tipo_geometria !== "Point") {
        return;
    }

    const idCheckbox = CHECKBOX_POR_TABLA[capa.nombre_tabla];
    const checkbox = idCheckbox && document.getElementById(idCheckbox);

    if (!checkbox) {
        return;
    }

    const fila = checkbox.closest(".fila-capa");

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "btn-anadir-punto";
    boton.textContent = "+";
    boton.title = `Añadir punto en ${capa.etiqueta}`;
    boton.setAttribute("aria-label", `Añadir punto en ${capa.etiqueta}`);

    boton.addEventListener("click", function (evento) {

        // Está dentro de un <label>: sin esto, el clic también marcaría/
        // desmarcaría el checkbox de visibilidad de la capa.
        evento.preventDefault();
        evento.stopPropagation();

        boton.disabled = true;
        boton.classList.add("activo");
        boton.title = "Haz clic en el mapa…";

        activarModoColocarPunto(capa.nombre_tabla, function (coordenadas) {
            boton.disabled = false;
            boton.classList.remove("activo");
            boton.title = `Añadir punto en ${capa.etiqueta}`;

            peticionEdicion(`/edicion/sugerencia/${capa.nombre_tabla}?x=${coordenadas[0]}&y=${coordenadas[1]}`, "GET")
                .then(function (sugerencias) {
                    mostrarFormularioEdicion(capa.nombre_tabla, null, sugerencias, coordenadas, capa);
                })
                .catch(function () {
                    mostrarFormularioEdicion(capa.nombre_tabla, null, {}, coordenadas, capa);
                });
        });

    });

    fila.appendChild(boton);

}


function peticionEdicion(ruta, metodo, cuerpo) {

    const token = localStorage.getItem(claveTokenAuth);
    const opciones = {
        method: metodo,
        headers: { "Authorization": "Bearer " + token }
    };

    if (cuerpo) {
        opciones.headers["Content-Type"] = "application/json";
        opciones.body = JSON.stringify(cuerpo);
    }

    return fetch(apiAuthUrl + ruta, opciones)
        .then(function (respuesta) {

            return respuesta.json()
                .catch(function () {
                    return {};
                })
                .then(function (datos) {

                    if (!respuesta.ok) {
                        throw new Error(datos.mensaje || "No se ha podido completar la operación.");
                    }

                    return datos;
                });

        })
        .catch(function (error) {

            if (error instanceof TypeError) {
                throw new Error("No se ha podido conectar con el servidor.");
            }

            throw error;
        });

}
