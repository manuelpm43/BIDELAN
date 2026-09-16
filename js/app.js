IDEE.config("backgroundlayers", [
    {
        id: "ortofoto",
        title: "Ortofoto",
        layers: [
            "WMTS*https://www.ign.es/wmts/pnoa-ma?*OI.OrthoimageCoverage*GoogleMapsCompatible*imagen*false*image/jpeg*false*false*true"
        ]
    },
    {
        id: "cartografia",
        title: "Carto",
        layers: [
            "WMTS*https://www.ign.es/wmts/ign-base?*IGNBaseTodo*GoogleMapsCompatible*Callejero*false*image/png*false*false*true"
        ]
    },
    {
        id: "hibrido",
        title: "Híbrido",
        layers: [
            "WMTS*https://www.ign.es/wmts/pnoa-ma?*OI.OrthoimageCoverage*GoogleMapsCompatible*imagen*true*image/jpeg*false*false*true",
            "WMTS*https://www.ign.es/wmts/ign-base?*IGNBaseOrto*GoogleMapsCompatible*Callejero*true*image/png*false*false*true"
        ]
    }
]);

const mapa = IDEE.map({
    container: 'mapa',
    controls: ['panzoom', 'scale*true', 'scaleline', 'rotate', 'location', 'backgroundlayers'],
    zoom: 5,
    center: [-467062.8225, 4983459.6216]
});
console.log(mapa);

// Servicio GeoServer del proyecto BIDELAN (vía proxy nginx con HTTPS)
const geoserverWfsUrl = "https://visor.geospatiallab.xyz/geoserver/bidelan/ows";

const capaPKv0 = new IDEE.layer.WMS({
    url: "https://visor.geospatiallab.xyz/geoserver/bidelan/wms",
    name: "bidelan:pk_v0",
    legend: "Puntos kilométricos",
    useCapabilities: false
}, {
    crossOrigin: null
});
mapa.addLayers(capaPKv0);

const capaPartesAccidentes = new IDEE.layer.WMS({
    url: "https://visor.geospatiallab.xyz/geoserver/bidelan/wms",
    name: "bidelan:partes_accidentes",
    legend: "Partes de accidentes",
    useCapabilities: false
}, {
    crossOrigin: null
});
mapa.addLayers(capaPartesAccidentes);

/* Encuadre inicial: ajusta el zoom a la extensión real de bidelan:pk_v0 */
fetch(`${geoserverWfsUrl}?service=WFS&version=2.0.0&request=GetFeature&typeNames=bidelan:pk_v0&outputFormat=application/json&srsName=EPSG:3857`)
    .then(function (respuesta) {

        if (!respuesta.ok) {
            throw new Error(
                `No se pudo consultar la extensión de la capa: ${respuesta.status}`
            );
        }

        return respuesta.json();
    })
    .then(function (geojson) {

        mapa.setBbox(
            extensionDeFeatures(geojson.features)
        );

    })
    .catch(function (error) {

        console.error("Error al encuadrar la capa de puntos kilométricos:", error);

    });


function extensionDeFeatures(features) {

    const coordenadasX = features.map(function (feature) {
        return feature.geometry.coordinates[0];
    });

    const coordenadasY = features.map(function (feature) {
        return feature.geometry.coordinates[1];
    });

    return [
        Math.min(...coordenadasX),
        Math.min(...coordenadasY),
        Math.max(...coordenadasX),
        Math.max(...coordenadasY)
    ];

}


mapa.on("click", function (evento) {

    const coordenadas = evento.coord;
    const resolucion = evento.vendor.map.getView().getResolution();

    consultarPKv0(coordenadas, resolucion);

});


/**
 * Consulta por WFS el punto kilométrico más cercano a unas coordenadas,
 * dentro de una tolerancia en píxeles, y muestra su ficha en el panel.
 *
 * @param {Array<number>} coordenadas - Coordenadas del click, en la proyección del mapa.
 * @param {number} resolucion - Resolución actual del mapa (unidades de mapa por píxel).
 */
function consultarPKv0(coordenadas, resolucion) {

    const toleranciaPixeles = 6;
    const buffer = resolucion * toleranciaPixeles;

    const bbox = [
        coordenadas[0] - buffer,
        coordenadas[1] - buffer,
        coordenadas[0] + buffer,
        coordenadas[1] + buffer
    ].join(",");

    const url = `${geoserverWfsUrl}?service=WFS&version=2.0.0&request=GetFeature&typeNames=bidelan:pk_v0&outputFormat=application/json&srsName=EPSG:3857&bbox=${bbox},EPSG:3857`;

    fetch(url)
        .then(function (respuesta) {

            if (!respuesta.ok) {
                throw new Error(
                    `No se pudo consultar el WFS: ${respuesta.status}`
                );
            }

            return respuesta.json();
        })
        .then(function (geojson) {

            if (geojson.features.length === 0) {
                console.log("No hay punto kilométrico en este punto");
                return;
            }

            const featureMasCercana = featureMasCercanaA(
                coordenadas,
                geojson.features
            );

            mostrarInfoPK(featureMasCercana.properties);

        })
        .catch(function (error) {

            console.error("Error al consultar el punto kilométrico:", error);

        });

}


function featureMasCercanaA(coordenadas, features) {

    return features.reduce(function (masCercana, actual) {

        const distanciaActual = distanciaEntrePuntos(
            coordenadas,
            actual.geometry.coordinates
        );

        const distanciaMasCercana = distanciaEntrePuntos(
            coordenadas,
            masCercana.geometry.coordinates
        );

        return distanciaActual < distanciaMasCercana ? actual : masCercana;

    });

}


function distanciaEntrePuntos(a, b) {

    const dx = a[0] - b[0];
    const dy = a[1] - b[1];

    return Math.sqrt(dx * dx + dy * dy);

}
