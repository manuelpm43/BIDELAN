-- Da de alta pk_v0 como capa editable, ya confirmado su esquema real:
--   fid (bigint, PK sin default) / geom geometry(Point,25830) / CARRETERA /
--   SENTIDO / PK / IDCTRAMO (X, Y e id_objeto quedan fuera, son derivados).
--
-- Importante: la tabla esta en SRID 25830 (ETRS89 UTM 30N), no 3857. El
-- backend (backend/edicion.js) reproyecta siempre desde 3857 (la
-- proyeccion del mapa) al SRID nativo de la capa antes de guardar.

INSERT INTO public.capas_editables (nombre_tabla, etiqueta, campo_pk, tipo_geometria, srid, campos_editables)
VALUES (
    'pk_v0',
    'Puntos Kilométricos',
    'fid',
    'Point',
    25830,
    '[
        {"campo":"CARRETERA","tipo":"text","etiqueta":"Carretera"},
        {"campo":"PK","tipo":"text","etiqueta":"PK"},
        {"campo":"SENTIDO","tipo":"text","etiqueta":"Sentido"},
        {"campo":"IDCTRAMO","tipo":"text","etiqueta":"Tramo"}
    ]'::jsonb
)
ON CONFLICT (nombre_tabla) DO NOTHING;
