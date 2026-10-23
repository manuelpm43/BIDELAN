// Barrera de acceso al visor: sin sesión iniciada, redirige a login.html
// antes de crear el mapa (evita gastar peticiones a GeoServer de balde).
// Solo comprueba que exista un token guardado, igual que admin.html — la
// validación real de permisos para editar sigue haciéndose en el backend
// en cada petición a /edicion y /adjuntos.
if (!localStorage.getItem(claveTokenAuth)) {
    window.location.href = 'login.html';
}
