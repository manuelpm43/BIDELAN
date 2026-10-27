// Panel inferior "Tabla de atributos", al estilo de los visores de ArcGIS
// Online: una pestaña por cada capa consultable (las registradas en
// capasVisor, definido en app.js), con su tabla de atributos y un botón
// para encuadrar el mapa sobre cualquier elemento ("Zoom to").
//
// Depende de globals ya definidos antes en index.html: mapa, capasVisor,
// geoserverWfsUrl (app.js) y escaparHtml (panel.js).

const ETIQUETAS_CAPA_TABLA = {
    pk_v0: "Puntos Kilométricos",
    partes_accidentes: "Partes de Accidentes",
    aus_estructuras_2026: "Auscultación Estructuras 2026"
};

let claveCapaActivaTabla = null;
let filtradoPorExtensionActivo = false;
const cacheDatosTabla = {};


document.addEventListener("DOMContentLoaded", function () {

    construirPestanasCapas();

    document.getElementById("btnAbrirTablaAtributos").addEventListener("click", alternarPanelTabla);
    document.getElementById("btnCerrarTablaAtributos").addEventListener("click", function () {
        alternarPanelTabla(false);
    });
    document.getElementById("btnActualizarTabla").addEventListener("click", function () {
        filtradoPorExtensionActivo = false;
        cargarDatosCapaActiva(true);
    });
    document.getElementById("btnFiltrarExtensionTabla").addEventListener("click", function () {
        filtradoPorExtensionActivo = true;
        cargarDatosCapaActiva(true);
    });

});


function construirPestanasCapas() {

    const contenedorPestanas = document.getElementById("pestanasCapasTabla");
    const claves = Object.keys(capasVisor);

    claves.forEach(function (clave, indice) {

        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "pestana-capa-tabla" + (indice === 0 ? " activa" : "");
        boton.textContent = ETIQUETAS_CAPA_TABLA[clave] || clave;
        boton.dataset.clave = clave;

        boton.addEventListener("click", function () {
            seleccionarPestanaCapa(clave);
        });

        contenedorPestanas.appendChild(boton);

    });

    if (claves.length > 0) {
        claveCapaActivaTabla = claves[0];
    }

}


function alternarPanelTabla(forzarAbierto) {

    const contenido = document.getElementById("contenidoTablaAtributos");
    const flecha = document.querySelector("#btnAbrirTablaAtributos .flecha-tabla");

    const abrir = typeof forzarAbierto === "boolean" ? forzarAbierto : contenido.hidden;

    contenido.hidden = !abrir;
    flecha.textContent = abrir ? "▼" : "▲";

    if (abrir && claveCapaActivaTabla && !cacheDatosTabla[claveCapaActivaTabla]) {
        cargarDatosCapaActiva();
    }

}


function seleccionarPestanaCapa(clave) {

    claveCapaActivaTabla = clave;
    filtradoPorExtensionActivo = false;

    document.querySelectorAll(".pestana-capa-tabla").forEach(function (boton) {
        boton.classList.toggle("activa", boton.dataset.clave === clave);
    });

    if (cacheDatosTabla[clave]) {
        renderizarTabla(cacheDatosTabla[clave]);
    } else {
        cargarDatosCapaActiva();
    }

}


function cargarDatosCapaActiva(forzarRecarga) {

    const clave = claveCapaActivaTabla;
    if (!clave) {
        return;
    }

    const infoCapa = capasVisor[clave];
    const aviso = document.getElementById("avisoTablaAtributos");

    aviso.textContent = "Cargando…";

    let url = `${geoserverWfsUrl}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${infoCapa.typeName}&outputFormat=application/json&srsName=EPSG:3857`;

    if (filtradoPorExtensionActivo) {
        const bbox = obtenerBboxMapaActual();
        if (bbox) {
            url += `&bbox=${bbox.join(",")},EPSG:3857`;
        }
    }

    fetch(url)
        .then(function (respuesta) {

            if (!respuesta.ok) {
                throw new Error(`No se pudo consultar la capa: ${respuesta.status}`);
            }

            return respuesta.json();
        })
        .then(function (geojson) {

            const datos = { features: geojson.features || [] };

            if (!filtradoPorExtensionActivo) {
                cacheDatosTabla[clave] = datos;
            }

            aviso.textContent = "";
            renderizarTabla(datos);

        })
        .catch(function (error) {

            aviso.textContent = error.message;
            console.error("Error al cargar la tabla de atributos:", error);

        });

}


/** Extrae el bbox actual del mapa, probando las formas conocidas de la API-IDEE. */
function obtenerBboxMapaActual() {

    try {

        const bbox = mapa.getBbox();

        if (Array.isArray(bbox)) {
            return bbox;
        }

        if (bbox && bbox.x && bbox.y) {
            return [bbox.x.min, bbox.y.min, bbox.x.max, bbox.y.max];
        }

    } catch (error) {
        console.error("No se ha podido obtener la extensión actual del mapa:", error);
    }

    return null;

}


function renderizarTabla(datos) {

    const features = datos.features;
    const cabecera = document.getElementById("cabeceraColumnasTabla");
    const cuerpo = document.getElementById("filasTablaAtributos");
    const aviso = document.getElementById("avisoTablaAtributos");

    cabecera.innerHTML = "";
    cuerpo.innerHTML = "";

    if (features.length === 0) {
        aviso.textContent = "No hay elementos para mostrar.";
        return;
    }

    const columnas = Object.keys(features[0].properties || {});

    const filaCabecera = document.createElement("tr");
    columnas.forEach(function (columna) {
        const celda = document.createElement("th");
        celda.textContent = columna;
        filaCabecera.appendChild(celda);
    });
    const celdaAccionesCabecera = document.createElement("th");
    celdaAccionesCabecera.textContent = "Acciones";
    filaCabecera.appendChild(celdaAccionesCabecera);
    cabecera.appendChild(filaCabecera);

    features.forEach(function (feature) {

        const fila = document.createElement("tr");

        columnas.forEach(function (columna) {
            const celda = document.createElement("td");
            celda.textContent = feature.properties[columna] ?? "";
            fila.appendChild(celda);
        });

        const celdaAcciones = document.createElement("td");
        const botonZoom = document.createElement("button");
        botonZoom.type = "button";
        botonZoom.className = "btn-zoom-to-fila";
        botonZoom.textContent = "🔍 Zoom to";
        botonZoom.addEventListener("click", function () {
            zoomAFeature(feature);
        });
        celdaAcciones.appendChild(botonZoom);
        fila.appendChild(celdaAcciones);

        cuerpo.appendChild(fila);

    });

    aviso.textContent = `${features.length} elemento(s)`;

}


function zoomAFeature(feature) {

    if (!feature.geometry) {
        return;
    }

    const extension = extensionDeGeometria(feature.geometry);

    // Si es un punto (o la geometría no tiene anchura/altura), se añade un
    // margen para no pedirle al mapa un encuadre de tamaño cero.
    const MARGEN_MINIMO = 150;
    if (extension[2] - extension[0] < 1) {
        extension[0] -= MARGEN_MINIMO;
        extension[2] += MARGEN_MINIMO;
    }
    if (extension[3] - extension[1] < 1) {
        extension[1] -= MARGEN_MINIMO;
        extension[3] += MARGEN_MINIMO;
    }

    mapa.setBbox(extension);

}


/** Bbox [minX, minY, maxX, maxY] de cualquier geometría GeoJSON, sea cual sea su tipo. */
function extensionDeGeometria(geometry) {

    const puntos = [];

    (function extraerPuntos(coordenadas) {
        if (typeof coordenadas[0] === "number") {
            puntos.push(coordenadas);
        } else {
            coordenadas.forEach(extraerPuntos);
        }
    })(geometry.coordinates);

    const equisX = puntos.map(function (p) { return p[0]; });
    const equisY = puntos.map(function (p) { return p[1]; });

    return [Math.min(...equisX), Math.min(...equisY), Math.max(...equisX), Math.max(...equisY)];

}
