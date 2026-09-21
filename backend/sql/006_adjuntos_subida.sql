-- Subida de adjuntos desde el visor (backend/adjuntos.js, POST /adjuntos/:tabla/:pk).
--
-- Las capas importadas de AGOL ya tienen su tabla <capa>_adjuntos (creada por
-- tools/importar-agol). pk_v0 no, asi que se crea aqui con el mismo esquema;
-- ON DELETE CASCADE para poder borrar un punto que tenga adjuntos.
--
-- Ejecutar como propietario de las tablas (postgres).

CREATE TABLE IF NOT EXISTS public.pk_v0_adjuntos (
    id serial PRIMARY KEY,
    feature_objectid bigint NOT NULL REFERENCES public.pk_v0(fid) ON DELETE CASCADE,
    nombre_archivo text NOT NULL,
    ruta_relativa text NOT NULL,
    tipo_contenido text,
    tamano_bytes bigint
);

-- bidelan_auth solo tenia lectura sobre las tablas de adjuntos; ahora tambien inserta.
GRANT SELECT, INSERT ON public.pk_v0_adjuntos, public.partes_accidentes_adjuntos TO bidelan_auth;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO bidelan_auth;
