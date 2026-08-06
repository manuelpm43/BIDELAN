const overlayFichaPK = document.getElementById("overlayFichaPK");
const btnCerrarFichaPK = document.getElementById("btnCerrarFichaPK");
const contenidoFichaPK = document.getElementById("contenidoFichaPK");
const popupFichaPK = document.querySelector(".popup-ficha-pk");
const cabeceraFichaPK = document.querySelector(".cabecera-ficha-pk");


function mostrarInfoPK(atributos) {

    contenidoFichaPK.innerHTML = `
        <div class="ficha-pk-panel">
            <h3>🛣 ${atributos.CARRETERA ?? "Sin carretera"}</h3>

            <p><b>PK:</b> ${atributos.PK ?? "-"}</p>
            <p><b>Sentido:</b> ${atributos.SENTIDO ?? "-"}</p>
            <p><b>Tramo:</b> ${atributos.IDCTRAMO ?? "-"}</p>
        </div>
    `;

    mostrarFichaPK();
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


/* Cerrar al hacer clic fuera del recuadro blanco */
overlayFichaPK.addEventListener("click", function (evento) {

    if (evento.target === overlayFichaPK) {
        ocultarFichaPK();
    }

});


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
