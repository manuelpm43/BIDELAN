# Backend de autenticación BIDELAN

API mínima con Node.js + Express que sustituye al mock de `js/auth.js`:
`POST /auth/register` y `POST /auth/login`, contraseñas con `bcrypt` y sesión
mediante JWT. Usa la misma PostgreSQL que GeoServer, en una tabla nueva
(`usuarios`) que no interfiere con las capas geográficas.

## Puesta en marcha (desarrollo local)

1. Instalar dependencias:
   ```
   cd backend
   npm install
   ```
2. Copiar `.env.example` a `.env` y rellenar los valores reales (usuario y
   contraseña de PostgreSQL, secreto JWT, origen permitido para CORS).
3. Crear la tabla en la base de datos:
   ```
   psql -h 217.71.202.62 -U <usuario_admin> -d bidelan -f sql/001_crear_usuarios.sql
   ```
4. Arrancar el servidor:
   ```
   npm run dev
   ```
   Comprobar que responde en `http://localhost:4000/health`.

## Despliegue junto a GeoServer (217.71.202.62)

1. Copiar la carpeta `backend/` al servidor (sin `node_modules` ni `.env`).
2. `npm install --production` y crear el `.env` real en el servidor (nunca
   subirlo al repositorio).
3. Ejecutar el proceso con un gestor persistente, por ejemplo PM2:
   ```
   pm2 start server.js --name bidelan-auth
   ```
4. Exponer el puerto (por defecto `4000`) hacia fuera, idealmente detrás de
   un proxy inverso (nginx) con HTTPS, en vez de abrirlo directamente.
5. En `ORIGEN_PERMITIDO`, poner la URL real desde la que se sirve el visor
   (para que CORS deje pasar las peticiones del navegador).

## Conectar el frontend

En `js/auth.js`, cuando el backend esté desplegado y verificado:

- `apiAuthUrl` → la URL base del backend (p. ej. `http://217.71.202.62:4000`).
- `modoMockAuth` → `false`.

A partir de ahí, `peticionAuth()` deja de usar `localStorage` y llama de
verdad a `/auth/login` y `/auth/register`.

## Notas de seguridad

- Las contraseñas nunca se guardan en claro: se almacena solo
  `password_hash` (bcrypt, 10 rondas).
- El JWT no lleva más que `id` y `email`; su secreto (`JWT_SECRETO`) debe
  ser largo, aleatorio y distinto en cada entorno.
- Servir esta API por HTTPS en producción: un JWT viajando por HTTP plano
  puede ser interceptado igual que cualquier otra credencial.
