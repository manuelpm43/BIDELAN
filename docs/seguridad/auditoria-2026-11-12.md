# Auditoría de seguridad — 2026-11-12

Primera ejecución completa de `/custom-security-review` (los 8 agentes especializados
definidos en `.claude/agents/`, apoyados en los escáneres de `scripts/security/`).
Alcance: todo el repositorio (frontend estático, `backend/`, `tools/importar-agol/`).

## Resumen ejecutivo

- **Nivel de riesgo global: ALTO**
- **Puntuación: 100/100** (capada; cálculo real 105 = 1 CRÍTICO×25 + 4 ALTOS×10 + 11 MEDIOS×3 + 7 BAJOS×1)
- Los tres hallazgos más graves:
  1. Path traversal real y explotable en `tools/importar-agol` (adjuntos de ArcGIS Online sin sanear, escritura fuera de carpeta tanto en local como vía SFTP en el servidor de producción).
  2. JWT de sesión con validez de 7 días sin ningún mecanismo de revocación — un cambio de rol no invalida los tokens ya emitidos.
  3. `backend/` no tiene `package-lock.json` ni `node_modules`: cada despliegue instala versiones no verificadas.

## Hallazgos

### 🔴 CRÍTICO

**Path traversal en adjuntos de ArcGIS Online — CWE-22**
- `tools/importar-agol/src/agol.js:175-186` (`descargarAdjunto`), `tools/importar-agol/importar-capa.js:175,179`, `tools/importar-agol/src/sftp.js:35-41`.
- `adj.name` (nombre de adjunto, controlado por cualquiera con permiso de edición sobre la capa en AGOL) se usa sin sanear para la ruta local, la ruta SFTP remota y el valor `ruta_relativa` guardado en Postgres. Un nombre tipo `../../../../etc/cron.d/x` escribiría fuera de la carpeta prevista **en el servidor de producción**, con las credenciales reales del despliegue.
- `backend/adjuntos.js` ya tiene la protección equivalente (`limpiarNombreArchivo()`); aquí falta.
- Remediación: aplicar el mismo saneado antes de construir `destino`, `rutaRemota` y `rutaRelativa`.

### 🟠 ALTO

- **JWT de 7 días sin revocación** (`backend/auth.js:110-116`) — sin logout ni lista de revocación; un cambio de rol (`backend/admin.js`, `manejarCambiarRol`) no invalida los tokens ya emitidos.
- **Condición de carrera al generar el siguiente PK** (`backend/edicion.js:150`, `manejarCrear`) — `MAX(pk)+1` dentro del propio INSERT, sin secuencia ni bloqueo; dos ediciones simultáneas pueden chocar.
- **Verificación de certificado TLS desactivada para Postgres** (`backend/db.js:9`, `tools/importar-agol/importar-capa.js:133`) — `rejectUnauthorized: false` cuando `PGSSLMODE=require`.
- **`backend/` sin `package-lock.json` ni `node_modules`** — cada despliegue resuelve versiones nuevas sin hash de integridad.

### 🟡 MEDIO

- `GRANT ALL` de más a `bidelan_auth` sobre `auditoria_edicion`/`capas_editables` (`backend/sql/003_edicion_mapa.sql`) — debería ser solo `SELECT`/`INSERT`.
- GeoServer corre como `root` (systemd) — sin necesidad arquitectónica.
- Filtración de tiempos en el login permite enumerar qué emails están registrados.
- Coste de bcrypt en 10, recomendado ≥12 (`backend/auth.js`, `bootstrapAdmin.js`).
- Sin cabeceras de seguridad (helmet/CSP/HSTS) en el backend Express — depende solo de nginx, que no está en este repo.
- CORS cae a `'*'` si `ORIGEN_PERMITIDO` no está definido — debería fallar cerrado.
- `jwt.verify`/`sign` sin fijar el algoritmo explícitamente (defensa en profundidad).
- Condición de carrera en `manejarActualizar` (ediciones) — sin control de concurrencia optimista.
- `tools/importar-agol/package-lock.json` existía pero no estaba en git (corregido en este mismo commit).
- Cierre del puerto 4000 del backend sigue sin verificarse.
- `CLAUDE.md` afirmaba que las reglas de seguridad "se aplican por hooks" sin que existiera ningún hook.

### 🟢 BAJO

- Sin longitud máxima de contraseña.
- Dependencias sin versión exacta fijada (`^x.y.z` en ambos `package.json`).
- Identificadores SQL sin comillas en `tools/importar-agol/src/postgres.js` (seguro hoy solo porque quien llama ya sanea antes).
- `.claude/settings.local.json` permitía `curl` directo al puerto 8080 de GeoServer en vez del dominio HTTPS público.
- Puerto 8080 de GeoServer sigue abierto externamente sin que nada lo necesite.
- Scripts de API-IDEE/Google Maps cargados por CDN sin Subresource Integrity.
- Límite de peticiones genérico (120/min) para rutas sensibles.

### ℹ️ Limpio (verificado, no solo asumido)

Sin inyección SQL real (el patrón de lista blanca de tablas se cumple en todos los sitios), sin XSS (todo pasa por `escaparHtml()`/`textContent`), sin secretos en git ni en el historial, sin typosquatting ni scripts `postinstall` maliciosos, sin inyección de prompt en `CLAUDE.md` ni en los agentes, sin `alg:none` ni secreto JWT por defecto.

**Fuera del repo, a vigilar:** esta sesión tenía conectados servidores MCP (`arcgis`, `rustgis`) con control amplio de escritorio/red, no declarados en este proyecto.

## Estado tras esta sesión

Corregido en el mismo lote que esta auditoría (ver commit): `tools/importar-agol/package-lock.json` añadido a git. El resto de hallazgos sigue pendiente — ver `BIDELAN.md` para el registro de versiones a medida que se vayan resolviendo.
