-- Sustituye tramos_calibrados_prueba (capa de prueba, 67 filas) por
-- eje_ref_tramo (capa definitiva y pulida, 431 filas) como fuente del
-- autorelleno vial (backend/referenciaVial.js) y de la capa visual de ejes
-- en el visor (js/app.js).
--
-- Ejecutar como propietario de las tablas (postgres).

-- Indice espacial en la capa de ejes nueva (para el operador <-> de vecino mas cercano).
DO $$
DECLARE
    columna text;
BEGIN
    SELECT f_geometry_column INTO columna
      FROM geometry_columns
     WHERE f_table_schema = 'public' AND f_table_name = 'eje_ref_tramo';

    IF columna IS NOT NULL THEN
        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS eje_ref_tramo_geom_idx ON public.eje_ref_tramo USING GIST (%I)',
            columna
        );
    END IF;
END $$;

-- Permiso de lectura para el backend:
GRANT SELECT ON public.eje_ref_tramo TO bidelan_auth;

-- La tabla vieja ya no se usa: se retira el permiso y se elimina.
REVOKE SELECT ON public.tramos_calibrados_prueba FROM bidelan_auth;
DROP TABLE IF EXISTS public.tramos_calibrados_prueba;
