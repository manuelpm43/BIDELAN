-- El PK pasa a dos campos (backend/referenciaVial.js):
--   PK           = parte entera (hito kilometrico), ya existia
--   PK_CALCULADO = parte calculada (metros recorridos sobre el segmento del eje)
--
-- Ejecutar como propietario de las tablas (postgres).

ALTER TABLE public.pk_v0
    ADD COLUMN IF NOT EXISTS "PK_CALCULADO" text;

ALTER TABLE public.partes_accidentes
    ADD COLUMN IF NOT EXISTS "PK_CALCULADO" text;

-- Renombra la etiqueta de PK y anade PK_CALCULADO a los campos editables (idempotente).
UPDATE public.capas_editables
   SET campos_editables = (
           SELECT jsonb_agg(
                      CASE WHEN e->>'campo' = 'PK'
                           THEN jsonb_set(e, '{etiqueta}', '"PK (entero)"')
                           ELSE e END
                  )
             FROM jsonb_array_elements(campos_editables) AS e
       ) || (
           SELECT COALESCE(jsonb_agg(f), '[]'::jsonb)
             FROM jsonb_array_elements('[{"campo":"PK_CALCULADO","tipo":"text","etiqueta":"PK (calculado)"}]'::jsonb) AS f
            WHERE NOT campos_editables @> '[{"campo":"PK_CALCULADO"}]'::jsonb
       )
 WHERE nombre_tabla IN ('pk_v0', 'partes_accidentes');
