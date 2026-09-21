-- Autorelleno de CARRETERA / TIPO / PK / SENTIDO / SITUACION al crear puntos,
-- a partir del eje mas cercano en public.tramos_calibrados_prueba
-- (backend/referenciaVial.js).
--
-- Ejecutar como propietario de las tablas (postgres): bidelan_auth no puede
-- hacer ALTER TABLE sobre pk_v0 ni partes_accidentes.

-- Interruptor por capa: solo las capas con true reciben sugerencias.
ALTER TABLE public.capas_editables
    ADD COLUMN IF NOT EXISTS sugerencias_viales boolean NOT NULL DEFAULT false;

-- Los cinco campos fijos como columnas reales (pk_v0 ya tiene CARRETERA, PK y SENTIDO).
ALTER TABLE public.pk_v0
    ADD COLUMN IF NOT EXISTS "TIPO" text,
    ADD COLUMN IF NOT EXISTS "SITUACION" text;

ALTER TABLE public.partes_accidentes
    ADD COLUMN IF NOT EXISTS "CARRETERA" text,
    ADD COLUMN IF NOT EXISTS "TIPO" text,
    ADD COLUMN IF NOT EXISTS "PK" text,
    ADD COLUMN IF NOT EXISTS "SENTIDO" text,
    ADD COLUMN IF NOT EXISTS "SITUACION" text;

-- Anade a campos_editables solo los que aun no estan (idempotente) y activa el interruptor.
UPDATE public.capas_editables
   SET campos_editables = campos_editables || (
           SELECT COALESCE(jsonb_agg(f), '[]'::jsonb)
             FROM jsonb_array_elements('[
                 {"campo":"CARRETERA","tipo":"text","etiqueta":"Carretera"},
                 {"campo":"TIPO","tipo":"text","etiqueta":"Tipo"},
                 {"campo":"PK","tipo":"text","etiqueta":"PK"},
                 {"campo":"SENTIDO","tipo":"text","etiqueta":"Sentido"},
                 {"campo":"SITUACION","tipo":"text","etiqueta":"Situación"}
             ]'::jsonb) AS f
            WHERE NOT campos_editables @> jsonb_build_array(jsonb_build_object('campo', f->>'campo'))
       ),
       sugerencias_viales = true
 WHERE nombre_tabla IN ('pk_v0', 'partes_accidentes');

-- Indice espacial en la capa de ejes (para el operador <-> de vecino mas cercano).
DO $$
DECLARE
    columna text;
BEGIN
    SELECT f_geometry_column INTO columna
      FROM geometry_columns
     WHERE f_table_schema = 'public' AND f_table_name = 'tramos_calibrados_prueba';

    IF columna IS NOT NULL THEN
        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS tramos_calibrados_prueba_geom_idx ON public.tramos_calibrados_prueba USING GIST (%I)',
            columna
        );
    END IF;
END $$;

-- Permiso de lectura para el backend (ejecutar como postgres):
GRANT SELECT ON public.tramos_calibrados_prueba TO bidelan_auth;
