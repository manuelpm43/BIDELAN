-- Permite editar datos del mapa (crear/mover/borrar puntos, editar atributos)
-- desde el propio visor, reutilizando el sistema de usuarios/JWT existente.
--
-- No hace falta migrar la columna "rol" (usuarios.rol es VARCHAR(20) sin
-- CHECK, ver 002_aprobacion_usuarios.sql): el valor 'editor' simplemente se
-- empieza a usar, asignado desde admin.html o con:
--   UPDATE usuarios SET rol = 'editor' WHERE email = 'correo@ejemplo.com';

-- Registro de qué tablas son editables desde el visor y qué campos se
-- pueden tocar. Es la única fuente de verdad que el backend consulta antes
-- de construir cualquier INSERT/UPDATE/DELETE: nunca se interpola un
-- nombre de tabla/columna que venga directamente del cliente.
CREATE TABLE IF NOT EXISTS public.capas_editables (
    nombre_tabla     text PRIMARY KEY,
    etiqueta         text NOT NULL,
    campo_pk         text NOT NULL,
    campo_geometria  text NOT NULL DEFAULT 'geom',
    tipo_geometria   text NOT NULL,
    srid             integer NOT NULL DEFAULT 3857,
    campos_editables jsonb NOT NULL,
    activa           boolean NOT NULL DEFAULT true
);

-- Histórico de cambios: quién creó/modificó/borró qué y cuándo.
CREATE TABLE IF NOT EXISTS public.auditoria_edicion (
    id            serial PRIMARY KEY,
    tabla         text NOT NULL,
    operacion     text NOT NULL,
    feature_pk    text NOT NULL,
    usuario_id    integer NOT NULL,
    usuario_email text NOT NULL,
    datos_antes   jsonb,
    datos_despues jsonb,
    creado_en     timestamptz NOT NULL DEFAULT now()
);

-- Alta de partes_accidentes como capa editable. pk_v0 se añade aparte, una
-- vez confirmado el nombre real de su columna PK (\d public.pk_v0).
INSERT INTO public.capas_editables (nombre_tabla, etiqueta, campo_pk, tipo_geometria, campos_editables)
VALUES (
    'partes_accidentes',
    'Partes de accidentes',
    'objectid_agol',
    'Point',
    '[
        {"campo":"dia","tipo":"date","etiqueta":"Día"},
        {"campo":"num_parte","tipo":"text","etiqueta":"Nº de parte"},
        {"campo":"ubicacion","tipo":"text","etiqueta":"Ubicación"},
        {"campo":"observaciones","tipo":"text","etiqueta":"Observaciones"},
        {"campo":"pk_del_parte","tipo":"text","etiqueta":"PK"}
    ]'::jsonb
)
ON CONFLICT (nombre_tabla) DO NOTHING;

-- Pendiente de ejecutar a mano (el rol bidelan_auth solo tenia permisos
-- sobre "usuarios" hasta ahora):
--   GRANT SELECT, INSERT, UPDATE, DELETE ON public.pk_v0, public.partes_accidentes TO bidelan_auth;
--   GRANT ALL ON public.capas_editables, public.auditoria_edicion TO bidelan_auth;
--   GRANT ALL ON public.auditoria_edicion_id_seq TO bidelan_auth;
