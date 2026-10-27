// Street View: un muñeco arrastrable (🚶) que se suelta sobre el mapa y
// abre una ventana con la vista 360° de Google en ese punto, al estilo del
// propio Google Maps. La clave de la API no está aquí: se pide al backend
// (GET /config/google-maps-key), que la lee de su .env — así no queda
// escrita en el repositorio.

const pegmanStreetView = document.getElementById("pegmanStreetView");
const overlayStreetView = document.getElementById("overlayStreetView");
const popupStreetView = document.querySelector(".popup-street-view");
const avisoStreetView = document.getElementById("avisoStreetView");
const cuerpoStreetView = document.getElementById("cuerpoStreetView");
const btnCerrarStreetView = document.getElementById("btnCerrarStreetView");

let googleMapsCargado = false;
let panoramaStreetView = null;
let servicioStreetView = null;


document.addEventListener("DOMContentLoaded", function () {

    cargarGoogleMaps();

    pegmanStreetView.addEventListener("dragstart", function (evento) {
        evento.dataTransfer.setData("text/plain", "pegman-street-view");
        evento.dataTransfer.effectAllowed = "move";
    });

    const mapaDiv = document.getElementById("mapa");

    mapaDiv.addEventListener("dragover", function (evento) {
        evento.preventDefault();
        evento.dataTransfer.dropEffect = "move";
    });

    mapaDiv.addEventListener("drop", function (evento) {

        evento.preventDefault();

        const coordenadas = coordenadasDesdeEventoDrop(evento);
        mostrarStreetViewEnCoordenadas(coordenadas);

    });

    btnCerrarStreetView.addEventListener("click", ocultarStreetView);

    document.addEventListener("keydown", function (evento) {
        if (evento.key === "Escape") {
            ocultarStreetView();
        }
    });

});


/**
 * Carga perezosa del script de Google Maps JavaScript API. Se pide la
 * clave al backend en vez de tenerla escrita en este archivo.
 */
function cargarGoogleMaps() {

    fetch(`${apiAuthUrl}/config/google-maps-key`)
        .then(function (respuesta) {
            return respuesta.json();
        })
        .then(function (datos) {

            if (!datos.apiKey) {
                console.error("No hay GOOGLE_MAPS_API_KEY configurada en el backend.");
                return;
            }

            const script = document.createElement("script");
            script.src = `https://maps.googleapis.com/maps/api/js?key=${datos.apiKey}`;
            script.onload = function () {
                googleMapsCargado = true;
                servicioStreetView = new google.maps.StreetViewService();
            };
            script.onerror = function () {
                console.error("No se ha podido cargar Google Maps.");
            };

            document.head.appendChild(script);

        })
        .catch(function (error) {
            console.error("Error al pedir la clave de Google Maps:", error);
        });

}


/**
 * Pixel del drop (relativo al viewport del mapa) -> coordenadas en la
 * proyección del mapa (EPSG:3857), vía el OpenLayers interno de API-IDEE.
 */
function coordenadasDesdeEventoDrop(evento) {

    const mapaOL = mapa.getMapImpl();
    const rect = mapaOL.getViewport().getBoundingClientRect();

    const x = evento.clientX - rect.left;
    const y = evento.clientY - rect.top;

    return mapaOL.getCoordinateFromPixel([x, y]);

}


/** EPSG:3857 (Web Mercator, la proyección del mapa) -> WGS84 (lat/lng). */
function metrosAWgs84(x, y) {

    const lng = (x / 20037508.34) * 180;
    let lat = (y / 20037508.34) * 180;
    lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);

    return { lat: lat, lng: lng };

}


function mostrarStreetViewEnCoordenadas(coordenadasMapa) {

    limpiarAvisoStreetView();
    mostrarPanelStreetView();

    if (!googleMapsCargado) {
        mostrarAvisoStreetView("Google Maps todavía se está cargando, inténtalo de nuevo en un momento.");
        return;
    }

    const posicion = metrosAWgs84(coordenadasMapa[0], coordenadasMapa[1]);

    mostrarAvisoStreetView("Buscando imágenes cercanas…");

    servicioStreetView.getPanorama({ location: posicion, radius: 75 }, function (datos, estado) {

        if (estado !== google.maps.StreetViewStatus.OK) {
            cuerpoStreetView.innerHTML = "";
            mostrarAvisoStreetView("No hay cobertura de Street View cerca de este punto.");
            return;
        }

        limpiarAvisoStreetView();

        if (!panoramaStreetView) {
            panoramaStreetView = new google.maps.StreetViewPanorama(cuerpoStreetView, {
                position: datos.location.latLng,
                pov: { heading: 0, pitch: 0 },
                zoom: 1
            });
        } else {
            panoramaStreetView.setPosition(datos.location.latLng);
        }

        // El panel pudo estar oculto al crear el panorama: sin esto, a
        // veces se queda con el tamaño a medias hasta que se redimensiona
        // la ventana.
        google.maps.event.trigger(panoramaStreetView, "resize");

    });

}


function mostrarPanelStreetView() {

    popupStreetView.style.left = "";
    popupStreetView.style.top = "";
    popupStreetView.style.transform = "";

    overlayStreetView.classList.add("active");

}


function ocultarStreetView() {
    overlayStreetView.classList.remove("active");
}


function mostrarAvisoStreetView(texto) {
    avisoStreetView.textContent = texto;
    avisoStreetView.hidden = false;
}


function limpiarAvisoStreetView() {
    avisoStreetView.textContent = "";
    avisoStreetView.hidden = true;
}
