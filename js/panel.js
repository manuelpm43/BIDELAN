const overlayFichaPK = document.getElementById("overlayFichaPK");
const btnCerrarFichaPK = document.getElementById("btnCerrarFichaPK");
const contenidoFichaPK = document.getElementById("contenidoFichaPK");
const popupFichaPK = document.querySelector(".popup-ficha-pk");
const cabeceraFichaPK = document.querySelector(".cabecera-ficha-pk");
const tituloCabeceraFicha = document.getElementById("tituloCabeceraFicha");


// Campos fijos que llevan todas las capas: van en la pestaña GEOMETRIA.
const CAMPOS_GEOMETRIA = [
    { campo: "CARRETERA", etiqueta: "Carretera" },
    { campo: "TIPO", etiqueta: "Tipo" },
    { campo: "PK", etiqueta: "PK" },
    { campo: "SENTIDO", etiqueta: "Sentido" },
    { campo: "SITUACION", etiqueta: "Situación" }
];

const NOMBRES_CAMPOS_GEOMETRIA = CAMPOS_GEOMETRIA.map(function (c) { return c.campo; });

// Sin sesión de edición no hay metadatos de la capa (capasEditablesActivas):
// pk_v0 conserva su ficha curada, con solo estos campos en DATOS.
const CAMPOS_DATOS_PK_V0 = [{ campo: "IDCTRAMO", etiqueta: "Tramo" }];

const TITULOS_SIN_METADATOS = { pk_v0: "Puntos Kilométricos" };


function mostrarInfoPK(atributos, pk, coordenadas) {
    mostrarFichaGenerica("pk_v0", pk, atributos, coordenadas);
}


function escaparHtml(valor) {

    return String(valor)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

}


/**
 * Campos de la pestaña GEOMETRIA. Con metadatos de la capa, solo los que la
 * capa tiene entre sus campos editables (con su definición); sin ellos, los cinco.
 */
function camposGeometriaDeFicha(capaEditable) {

    if (!capaEditable) {
        return CAMPOS_GEOMETRIA;
    }

    return NOMBRES_CAMPOS_GEOMETRIA
        .map(function (nombre) {
            return capaEditable.campos_editables.find(function (d) { return d.campo === nombre; });
        })
        .filter(Boolean);

}


/** Campos de la pestaña DATOS: todo lo que no es de GEOMETRIA. */
function camposDatosDeFicha(nombreTabla, capaEditable, atributos) {

    if (capaEditable) {
        return capaEditable.campos_editables.filter(function (d) {
            return !NOMBRES_CAMPOS_GEOMETRIA.includes(d.campo);
        });
    }

    if (nombreTabla === "pk_v0") {
        return CAMPOS_DATOS_PK_V0;
    }

    return Object.keys(atributos)
        .filter(function (campo) { return !NOMBRES_CAMPOS_GEOMETRIA.includes(campo); })
        .map(function (campo) { return { campo: campo, etiqueta: campo }; });

}


/** HTML de la barra de pestañas y sus paneles; la primera queda activa. */
function htmlPestanas(paneles) {

    const barra = paneles.map(function (p, i) {
        return `<button type="button" class="pestana-ficha${i === 0 ? " activa" : ""}" data-pestana="${p.id}">${p.titulo}</button>`;
    }).join("");

    const cuerpos = paneles.map(function (p, i) {
        return `<div class="panel-pestana${i === 0 ? " activo" : ""}" data-panel="${p.id}">${p.html}</div>`;
    }).join("");

    return `<div class="pestanas-ficha">${barra}</div>${cuerpos}`;

}


function activarPestanas() {

    contenidoFichaPK.querySelectorAll(".pestana-ficha").forEach(function (boton) {

        boton.addEventListener("click", function () {

            contenidoFichaPK.querySelectorAll(".pestana-ficha, .panel-pestana").forEach(function (elemento) {
                elemento.classList.remove("activa", "activo");
            });

            boton.classList.add("activa");
            contenidoFichaPK.querySelector(`.panel-pestana[data-panel="${boton.dataset.pestana}"]`).classList.add("activo");

        });

    });

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

    const fila = function (definicion) {
        return `<p><b>${escaparHtml(definicion.etiqueta)}:</b> ${escaparHtml(atributos[definicion.campo] ?? "-")}</p>`;
    };

    const filasGeometria = camposGeometriaDeFicha(capaEditable).map(fila).join("");
    const filasDatos = camposDatosDeFicha(nombreTabla, capaEditable, atributos).map(fila).join("");

    tituloCabeceraFicha.textContent = capaEditable?.etiqueta ?? TITULOS_SIN_METADATOS[nombreTabla] ?? nombreTabla;

    contenidoFichaPK.innerHTML = `
        <div class="ficha-pk-panel">
            ${htmlPestanas([
                { id: "geometria", titulo: "GEOMETRIA", html: filasGeometria },
                { id: "datos", titulo: "DATOS", html: filasDatos || `<p class="aviso-pestana">Sin datos.</p>` },
                { id: "adjuntos", titulo: "ADJUNTOS", html: `<div id="adjuntosFicha"></div>` }
            ])}
            ${renderBotonesEdicion(capaEditable)}
        </div>
    `;

    activarPestanas();
    activarBotonesEdicion(nombreTabla, pk, atributos, coordenadas, capaEditable);
    montarPestanaAdjuntos(nombreTabla, pk, document.getElementById("adjuntosFicha"), Boolean(capaEditable));

    mostrarFichaPK();
}


/**
 * Formulario de creación/edición para una capa editable. Si pk es null,
 * es un alta nueva (POST); si no, edita la existente (PUT).
 */
function mostrarFormularioEdicion(nombreTabla, pk, atributos, coordenadas, capaEditable) {

    let coordenadasActuales = coordenadas;

    const htmlCampo = function (definicion) {

        const valor = atributos[definicion.campo] ?? "";
        const tipoInput = definicion.tipo === "date" ? "date" : "text";
        const valorInput = definicion.tipo === "date" && valor
            ? String(valor).slice(0, 10)
            : valor;

        return `
            <label class="campo-formulario-edicion">
                ${escaparHtml(definicion.etiqueta)}
                <input type="${tipoInput}" name="${escaparHtml(definicion.campo)}" value="${escaparHtml(valorInput)}">
            </label>
        `;

    };

    const camposGeometria = camposGeometriaDeFicha(capaEditable).map(htmlCampo).join("");
    const camposDatos = camposDatosDeFicha(nombreTabla, capaEditable, atributos).map(htmlCampo).join("");

    tituloCabeceraFicha.textContent = capaEditable.etiqueta;

    contenidoFichaPK.innerHTML = `
        <div class="ficha-pk-panel">
            <h3>${pk === null ? "Nuevo elemento" : "Editar elemento"}</h3>

            <form id="formularioEdicionFicha">
                ${htmlPestanas([
                    {
                        id: "geometria",
                        titulo: "GEOMETRIA",
                        html: `${camposGeometria}
                               <button type="button" class="btn-ficha" id="btnReubicarFicha">📍 Reubicar en el mapa</button>`
                    },
                    { id: "datos", titulo: "DATOS", html: camposDatos || `<p class="aviso-pestana">Sin datos.</p>` },
                    { id: "adjuntos", titulo: "ADJUNTOS", html: `<div id="adjuntosFicha"></div>` }
                ])}

                <div class="acciones-ficha">
                    <button type="submit" class="btn-ficha btn-guardar-ficha">Guardar</button>
                    <button type="button" class="btn-ficha btn-cancelar-ficha">Cancelar</button>
                </div>
            </form>
        </div>
    `;

    const formulario = document.getElementById("formularioEdicionFicha");
    const btnReubicar = document.getElementById("btnReubicarFicha");

    activarPestanas();
    montarPestanaAdjuntos(nombreTabla, pk, document.getElementById("adjuntosFicha"), true);

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

        mostrarFichaGenerica(nombreTabla, pk, atributos, coordenadas);

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
