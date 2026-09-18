// apiAuthUrl y claveTokenAuth se definen en js/config.js
//
// Muestra las fotos/adjuntos de una feature en la ficha, solo si hay
// sesión iniciada (el backend exige un token válido, sin importar el
// rol). Sin sesión, no se hace ninguna petición y no se muestra nada.

function cargarYMostrarAdjuntos(nombreTabla, pk, contenedor) {

    const token = localStorage.getItem(claveTokenAuth);

    if (!token || pk === null) {
        return;
    }

    fetch(`${apiAuthUrl}/adjuntos/${nombreTabla}/${pk}`, {
        headers: { "Authorization": "Bearer " + token }
    })
        .then(function (respuesta) {

            if (!respuesta.ok) {
                throw new Error("No se han podido cargar los adjuntos.");
            }

            return respuesta.json();
        })
        .then(function (adjuntos) {

            adjuntos.forEach(function (adjunto) {
                mostrarMiniaturaAdjunto(nombreTabla, pk, adjunto, contenedor, token);
            });

        })
        .catch(function (error) {
            console.error("Error al cargar adjuntos:", error);
        });

}


function mostrarMiniaturaAdjunto(nombreTabla, pk, adjunto, contenedor, token) {

    fetch(`${apiAuthUrl}/adjuntos/${nombreTabla}/${pk}/${adjunto.id}`, {
        headers: { "Authorization": "Bearer " + token }
    })
        .then(function (respuesta) {

            if (!respuesta.ok) {
                throw new Error("No se ha podido descargar el adjunto.");
            }

            return respuesta.blob();
        })
        .then(function (blob) {

            const url = URL.createObjectURL(blob);

            const enlace = document.createElement("a");
            enlace.href = url;
            enlace.target = "_blank";
            enlace.rel = "noopener";
            enlace.title = adjunto.nombre_archivo;

            if ((adjunto.tipo_contenido || "").startsWith("image/")) {
                const imagen = document.createElement("img");
                imagen.src = url;
                imagen.alt = adjunto.nombre_archivo;
                imagen.className = "miniatura-adjunto";
                enlace.appendChild(imagen);
            } else {
                enlace.className = "enlace-adjunto";
                enlace.textContent = `📎 ${adjunto.nombre_archivo}`;
            }

            contenedor.appendChild(enlace);

        })
        .catch(function (error) {
            console.error("Error al mostrar adjunto:", error);
        });

}
