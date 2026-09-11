-- Tabla de usuarios para la autenticación de BIDELAN.
-- Se ejecuta sobre la misma base de datos PostgreSQL que usa GeoServer.

CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
