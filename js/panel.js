const overlayFichaPK = document.getElementById("overlayFichaPK");
const btnCerrarFichaPK = document.getElementById("btnCerrarFichaPK");
const contenidoFichaPK = document.getElementById("contenidoFichaPK");
const popupFichaPK = document.querySelector(".popup-ficha-pk");
const cabeceraFichaPK = document.querySelector(".cabecera-ficha-pk");
const tituloCabeceraFicha = document.getElementById("tituloCabeceraFicha");


function mostrarInfoPK(atributos, pk, coordenadas) {

    const capaEditable = window.capasEditablesActivas && window.capasEditablesActivas.pk_v0;

    tituloCabeceraFicha.textContent = "Puntos Kilométricos";

    contenidoFichaPK.innerHTML = `
        <div class="ficha-pk-panel">
            <h3>🛣 ${atributos.CARRETERA ?? "Sin carretera"}</h3>

            <p><b>PK:</b> ${atributos.PK ?? "-"}</p>
            <p><b>Sentido:</b> ${atributos.SENTIDO ?? "-"}</p>
            <p><b>Tramo:</b> ${atributos.IDCTRAMO ?? "-"}</p>

            ${renderBotonesEdicion(capaEditable)}
        </div>
    `;

    activarBotonesEdicion("pk_v0", pk, atributos, coordenadas, capaEditable);

    mostrarFichaPK();
}


/**
 * HTML de los botones Editar/Eliminar, o cadena vacía si la capa no es
 * editable (o no hay permisos). Compartido entre mostrarInfoPK (pk_v0,
 * con plantilla propia) y mostrarFichaGenerica (cualquier otra capa).
 */
function renderBotonesEdicion(capaEditable) {

    if (!capaEditable) {
        return "";
    }

    return `
        <div class="acciones-ficha">
            <button type="button" class="btn-ficha btn-editar-ficha">Editar</button>
            <button type="button" class="btn-ficha btn-eliminar-ficha">Eliminar</button>
        </div>
    `;

}


/**
 * Engancha los listeners de los botones Editar/Eliminar renderizados por
 * renderBotonesEdicion. No hace nada si la capa no es editable.
 */
function activarBotonesEdicion(nombreTabla, pk, atributos, coordenadas, capaEditable) {

    if (!capaEditable) {
        return;
    }

    contenidoFichaPK.querySelector(".btn-editar-ficha").addEventListener("click", function () {
        mostrarFormularioEdicion(nombreTabla, pk, atributos, coordenadas, capaEditable);
    });

    contenidoFichaPK.querySelector(".btn-eliminar-ficha").addEventListener("click", function () {
        confirmarYEliminar(nombreTabla, pk, capaEditable);
    });

}


/**
 * Ficha genérica de solo lectura para cualquier capa consultada por clic
 * que no tenga una plantilla propia (como mostrarInfoPK la tiene para
 * pk_v0). Si la capa está en capasEditablesActivas (rellenado por
 * edicion.js) y el usuario tiene permisos, añade botones Editar/Eliminar.
 *
 * @param {string} nombreTabla - Nombre de la tabla en Postgres (p.ej. "partes_accidentes").
 * @param {*} pk - Valor de la clave primaria de la feature.
 * @param {object} atributos - Propiedades GeoJSON de la feature.
 * @param {Array<number>} coordenadas - Coordenadas de la geometría, para poder reubicarla.
 */
function mostrarFichaGenerica(nombreTabla, pk, atributos, coordenadas) {

    const capaEditable = window.capasEditablesActivas && window.capasEditablesActivas[nombreTabla];

    // Si hay metadatos de la capa (usuario con permisos de edición), se
    // muestran solo los campos curados en campos_editables, con su
    // etiqueta bonita. Sin permisos, no hay ese metadato disponible, así
    // que se listan todos los atributos tal cual los devuelve el WFS.
    const camposAMostrar = capaEditable
        ? capaEditable.campos_editables.map(function (definicion) { return definicion.campo; })
        : Object.keys(atributos);

    const filas = camposAMostrar
        .map(function (campo) {
            return `<p><b>${etiquetaCampo(capaEditable, campo)}:</b> ${atributos[campo] ?? "-"}</p>`;
        })
        .join("");

    tituloCabeceraFicha.textContent = capaEditable?.etiqueta ?? nombreTabla;

    contenidoFichaPK.innerHTML = `
        <div class="ficha-pk-panel">
            ${filas}
            ${renderBotonesEdicion(capaEditable)}
        </div>
    `;

    activarBotonesEdicion(nombreTabla, pk, atributos, coordenadas, capaEditable);

    mostrarFichaPK();
}


function etiquetaCampo(capaEditable, campo) {

    const definicion = capaEditable?.campos_editables?.find(function (c) { return c.campo === campo; });

    return definicion?.etiqueta ?? campo;

}


/**
 * Formulario de creación/edición para una capa editable. Si pk es null,
 * es un alta nueva (POST); si no, edita la existente (PUT).
 */
function mostrarFormularioEdicion(nombreTabla, pk, atributos, coordenadas, capaEditable) {

    let coordenadasActuales = coordenadas;

    const campos = capaEditable.campos_editables.map(function (definicion) {

        const valor = atributos[definicion.campo] ?? "";
        const tipoInput = definicion.tipo === "date" ? "date" : "text";
        const valorInput = definicion.tipo === "date" && valor
            ? String(valor).slice(0, 10)
            : valor;

        return `
            <label class="campo-formulario-edicion">
                ${definicion.etiqueta}
                <input type="${tipoInput}" name="${definicion.campo}" value="${valorInput}">
            </label>
        `;

    }).join("");

    tituloCabeceraFicha.textContent = capaEditable.etiqueta;

    contenidoFichaPK.innerHTML = `
        <div class="ficha-pk-panel">
            <h3>${pk === null ? "Nuevo elemento" : "Editar elemento"}</h3>

            <form id="formularioEdicionFicha">
                ${campos}

                <button type="button" class="btn-ficha" id="btnReubicarFicha">📍 Reubicar en el mapa</button>

                <div class="acciones-ficha">
                    <button type="submit" class="btn-ficha btn-guardar-ficha">Guardar</button>
                    <button type="button" class="btn-ficha btn-cancelar-ficha">Cancelar</button>
                </div>
            </form>
        </div>
    `;

    const formulario = document.getElementById("formularioEdicionFicha");
    const btnReubicar = document.getElementById("btnReubicarFicha");

    btnReubicar.addEventListener("click", function () {
        btnReubicar.textContent = "Haz clic en el mapa…";
        activarModoColocarPunto(nombreTabla, function (nuevasCoordenadas) {
            coordenadasActuales = nuevasCoordenadas;
            btnReubicar.textContent = "📍 Reubicar en el mapa (actualizado)";
        });
    });

    formulario.addEventListener("submit", function (evento) {

        evento.preventDefault();

        const datosFormulario = new FormData(formulario);
        const atributosNuevos = {};

        capaEditable.campos_editables.forEach(function (definicion) {
            atributosNuevos[definicion.campo] = datosFormulario.get(definicion.campo) || null;
        });

        const geometria = coordenadasActuales
            ? { type: "Point", coordinates: coordenadasActuales }
            : undefined;

        guardarFicha(nombreTabla, pk, atributosNuevos, geometria);

    });

    contenidoFichaPK.querySelector(".btn-cancelar-ficha").addEventListener("click", function () {

        if (pk === null) {
            ocultarFichaPK();
            return;
        }

        if (nombreTabla === "pk_v0") {
            mostrarInfoPK(atributos, pk, coordenadas);
        } else {
            mostrarFichaGenerica(nombreTabla, pk, atributos, coordenadas);
        }

    });

    mostrarFichaPK();
}


function confirmarYEliminar(nombreTabla, pk, capaEditable) {

    const confirmado = window.confirm(`¿Seguro que quieres eliminar este elemento de "${capaEditable.etiqueta}"? No se puede deshacer.`);

    if (!confirmado) {
        return;
    }

    peticionEdicion(`/edicion/${nombreTabla}/${pk}`, "DELETE")
        .then(function () {
            ocultarFichaPK();
            refrescarCapaPorTabla(nombreTabla);
        })
        .catch(function (error) {
            window.alert(error.message);
        });

}


function guardarFicha(nombreTabla, pk, atributos, geometria) {

    const cuerpo = { atributos: atributos };

    if (geometria) {
        cuerpo.geometria = geometria;
    }

    const peticion = pk === null
        ? peticionEdicion(`/edicion/${nombreTabla}`, "POST", cuerpo)
        : peticionEdicion(`/edicion/${nombreTabla}/${pk}`, "PUT", cuerpo);

    peticion
        .then(function () {
            ocultarFichaPK();
            refrescarCapaPorTabla(nombreTabla);
        })
        .catch(function (error) {
            window.alert(error.message);
        });

}


function mostrarFichaPK() {

    popupFichaPK.style.left = "";
    popupFichaPK.style.top = "";
    popupFichaPK.style.transform = "";

    overlayFichaPK.classList.add("active");

}


function ocultarFichaPK() {
    overlayFichaPK.classList.remove("active");
}


/* Cerrar con el botón X */
btnCerrarFichaPK.addEventListener("click", ocultarFichaPK);


/* Cerrar con la tecla Escape */
document.addEventListener("keydown", function (evento) {

    if (evento.key === "Escape") {
        ocultarFichaPK();
    }

});


/* Arrastrar la ventana emergente */
let arrastrandoFichaPK = false;
let offsetArrastreX = 0;
let offsetArrastreY = 0;

cabeceraFichaPK.addEventListener("mousedown", function (evento) {

    if (evento.target.closest(".btn-cerrar-ficha-pk")) {
        return;
    }

    const rect = popupFichaPK.getBoundingClientRect();

    offsetArrastreX = evento.clientX - rect.left;
    offsetArrastreY = evento.clientY - rect.top;

    popupFichaPK.style.left = `${rect.left}px`;
    popupFichaPK.style.top = `${rect.top}px`;
    popupFichaPK.style.transform = "none";

    arrastrandoFichaPK = true;
    popupFichaPK.classList.add("arrastrando");

});

document.addEventListener("mousemove", function (evento) {

    if (!arrastrandoFichaPK) {
        return;
    }

    popupFichaPK.style.left = `${evento.clientX - offsetArrastreX}px`;
    popupFichaPK.style.top = `${evento.clientY - offsetArrastreY}px`;

});

document.addEventListener("mouseup", function () {

    arrastrandoFichaPK = false;
    popupFichaPK.classList.remove("arrastrando");

});
