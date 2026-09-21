// apiAuthUrl y claveTokenAuth se definen en js/config.js
//
// Muestra las fotos/adjuntos de una feature en la ficha, solo si hay
// sesión iniciada (el backend exige un token válido, sin importar el
// rol). Sin sesión, no se hace ninguna petición y no se muestra nada.

/**
 * Rellena el contenido de la pestaña ADJUNTOS: miniaturas de los adjuntos
 * existentes y, si el usuario puede editar la capa, un botón para subir
 * fotos/PDF. Sin sesión o sin pk (elemento aún sin guardar) muestra un aviso.
 */
function montarPestanaAdjuntos(nombreTabla, pk, contenedor, puedeSubir) {

    if (!localStorage.getItem(claveTokenAuth)) {
        contenedor.innerHTML = `<p class="aviso-pestana">Inicia sesión para ver los adjuntos.</p>`;
        return;
    }

    if (pk === null) {
        contenedor.innerHTML = `<p class="aviso-pestana">Guarda el elemento para poder añadir adjuntos.</p>`;
        return;
    }

    contenedor.innerHTML = `<div class="adjuntos-ficha"></div>`;

    const listado = contenedor.querySelector(".adjuntos-ficha");

    cargarYMostrarAdjuntos(nombreTabla, pk, listado);

    if (!puedeSubir) {
        return;
    }

    const entrada = document.createElement("input");
    entrada.type = "file";
    entrada.accept = "image/jpeg,image/png,image/webp,image/gif,application/pdf";
    entrada.multiple = true;
    entrada.hidden = true;

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "btn-ficha btn-subir-adjunto";
    boton.textContent = "＋ Subir fotos";

    const estado = document.createElement("p");
    estado.className = "aviso-pestana";

    boton.addEventListener("click", function () {
        entrada.click();
    });

    entrada.addEventListener("change", function () {

        const archivos = Array.from(entrada.files);
        entrada.value = "";

        if (archivos.length === 0) {
            return;
        }

        boton.disabled = true;
        estado.textContent = `Subiendo ${archivos.length} archivo(s)…`;

        const errores = [];

        archivos
            .reduce(function (cadena, archivo) {
                return cadena
                    .then(function () {
                        return subirAdjunto(nombreTabla, pk, archivo, listado);
                    })
                    .catch(function (error) {
                        errores.push(`${archivo.name}: ${error.message}`);
                    });
            }, Promise.resolve())
            .then(function () {
                boton.disabled = false;
                estado.textContent = errores.join(" · ");
            });

    });

    contenedor.appendChild(boton);
    contenedor.appendChild(entrada);
    contenedor.appendChild(estado);

}


function subirAdjunto(nombreTabla, pk, archivo, listado) {

    const token = localStorage.getItem(claveTokenAuth);

    return fetch(`${apiAuthUrl}/adjuntos/${nombreTabla}/${pk}?nombre=${encodeURIComponent(archivo.name)}`, {
        method: "POST",
        headers: {
            "Authorization": "Bearer " + token,
            "Content-Type": archivo.type || "application/octet-stream"
        },
        body: archivo
    })
        .then(function (respuesta) {

            return respuesta.json()
                .catch(function () {
                    return {};
                })
                .then(function (datos) {

                    if (!respuesta.ok) {
                        throw new Error(datos.mensaje || (respuesta.status === 413 ? "Archivo demasiado grande (máx. 15 MB)." : "No se ha podido subir."));
                    }

                    mostrarMiniaturaAdjunto(nombreTabla, pk, datos, listado, token);
                });

        });

}


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
