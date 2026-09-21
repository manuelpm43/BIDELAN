const checkPKv0 = document.getElementById("checkPKv0");
const checkPartesAccidentes = document.getElementById("checkPartesAccidentes");
const checkEjes = document.getElementById("checkEjes");


/**
 * Activa o desactiva una capa API-IDEE.
 *
 * @param {object} capa - Capa creada con API-IDEE.
 * @param {boolean} visible - Estado de visibilidad.
 */
function cambiarVisibilidadCapa(capa, visible) {

    if (!capa) {
        console.error("La capa indicada no existe.");
        return;
    }

    const capaOpenLayers = capa
        .getImpl()
        .getOL3Layer();

    capaOpenLayers.setVisible(visible);
}


// Puntos kilométricos
checkPKv0.addEventListener("change", function () {

    cambiarVisibilidadCapa(
        capaPKv0,
        checkPKv0.checked
    );

});


// Partes de accidentes
checkPartesAccidentes.addEventListener("change", function () {

    cambiarVisibilidadCapa(
        capaPartesAccidentes,
        checkPartesAccidentes.checked
    );

});


// Ejes de carretera
checkEjes.addEventListener("change", function () {

    cambiarVisibilidadCapa(
        capaEjes,
        checkEjes.checked
    );

});
