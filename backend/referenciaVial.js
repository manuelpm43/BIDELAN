const TABLA_EJES = 'tramos_calibrados_prueba';
const SRID_MAPA = 3857;
const DISTANCIA_MAXIMA = 50; // metros (unidades del SRID del eje, que debe ser proyectado)
const DECIMALES_PK = 3;

let infoGeometriaEjes = null;

/**
 * Sentido de circulación codificado en el NOMBRE del eje.
 * Tronco: AAA-C (AP636-1). Ramal: AAA-BB-C-D (AP636-12-2-S).
 * Devuelve '1' (creciente), '2' (decreciente) o null si no encaja.
 */
function parsearSentido(nombre) {
    if (typeof nombre !== 'string') {
        return null;
    }

    const partes = nombre.trim().split('-');

    if (partes.length < 2) {
        return null;
    }

    const ultimo = partes[partes.length - 1];

    if (/^[12]$/.test(ultimo)) {
        return ultimo;
    }

    const penultimo = partes[partes.length - 2];

    return /^[12]$/.test(penultimo) ? penultimo : null;
}

/**
 * Lado del clic respecto al segmento A->B (sentido de avance del eje).
 * Con X=este, Y=norte, un producto vectorial positivo es "a la izquierda".
 */
function calcularLado(a, b, clic) {
    const producto = (b.x - a.x) * (clic.y - a.y) - (b.y - a.y) * (clic.x - a.x);

    if (producto < 0) {
        return 'Derecha';
    }

    return producto > 0 ? 'Izquierda' : null;
}

async function obtenerInfoGeometriaEjes(pool) {
    if (infoGeometriaEjes) {
        return infoGeometriaEjes;
    }

    const resultado = await pool.query(
        `SELECT f_geometry_column AS columna, srid
           FROM geometry_columns
          WHERE f_table_schema = 'public' AND f_table_name = $1`,
        [TABLA_EJES]
    );

    if (resultado.rows.length === 0) {
        throw new Error(`No se encuentra la geometría de public.${TABLA_EJES} en geometry_columns.`);
    }

    infoGeometriaEjes = resultado.rows[0];

    return infoGeometriaEjes;
}

/**
 * Sugiere CARRETERA, TIPO, PK, SENTIDO y SITUACION para un punto (x, y en
 * EPSG:3857) a partir del eje más cercano. Devuelve solo las claves que la
 * capa tiene entre sus campos editables. Si no hay eje a menos de
 * DISTANCIA_MAXIMA, o algo falla, devuelve {} para no bloquear el formulario.
 */
async function calcularSugerenciaVial(pool, capa, x, y) {
    if (!capa.sugerencias_viales) {
        return {};
    }

    try {
        const { columna, srid } = await obtenerInfoGeometriaEjes(pool);
        const geom = `"${String(columna).replace(/"/g, '""')}"`;

        const resultado = await pool.query(
            `WITH punto AS (
                 SELECT ST_Transform(ST_SetSRID(ST_MakePoint($1, $2), ${SRID_MAPA}), ${Number(srid)}) AS g
             ),
             cercano AS (
                 SELECT t."NOMBRE" AS nombre, t."TIPO" AS tipo, t.pk AS pk,
                        ST_LineMerge(ST_Multi(t.${geom})) AS g
                   FROM public."${TABLA_EJES}" t, punto p
                  ORDER BY t.${geom} <-> p.g
                  LIMIT 1
             )
             SELECT c.nombre, c.tipo, c.pk::float8 AS pk,
                    ST_Distance(c.g, p.g) AS distancia,
                    ST_LineLocatePoint(c.g, p.g) AS fraccion,
                    ST_Length(c.g) AS longitud,
                    s.ax, s.ay, s.bx, s.by,
                    ST_X(p.g) AS cx, ST_Y(p.g) AS cy
               FROM cercano c
              CROSS JOIN punto p
              CROSS JOIN LATERAL (
                    SELECT ST_X(ST_PointN(c.g, n)) AS ax, ST_Y(ST_PointN(c.g, n)) AS ay,
                           ST_X(ST_PointN(c.g, n + 1)) AS bx, ST_Y(ST_PointN(c.g, n + 1)) AS by
                      FROM generate_series(1, ST_NPoints(c.g) - 1) AS n
                     ORDER BY ST_Distance(ST_MakeLine(ST_PointN(c.g, n), ST_PointN(c.g, n + 1)), p.g)
                     LIMIT 1
              ) s
              WHERE GeometryType(c.g) = 'LINESTRING'`,
            [x, y]
        );

        const fila = resultado.rows[0];

        if (!fila || fila.distancia > DISTANCIA_MAXIMA) {
            return {};
        }

        const pkCalculado = fila.pk + fila.fraccion * (fila.longitud / 1000);
        const lado = calcularLado(
            { x: fila.ax, y: fila.ay },
            { x: fila.bx, y: fila.by },
            { x: fila.cx, y: fila.cy }
        );

        const calculados = {
            CARRETERA: fila.nombre,
            TIPO: fila.tipo,
            PK: pkCalculado.toFixed(DECIMALES_PK),
            SENTIDO: parsearSentido(fila.nombre),
            SITUACION: lado
        };

        const camposCapa = capa.campos_editables.map(function (c) { return c.campo; });
        const sugerencia = {};

        Object.keys(calculados).forEach(function (campo) {
            if (calculados[campo] !== null && calculados[campo] !== undefined && camposCapa.includes(campo)) {
                sugerencia[campo] = calculados[campo];
            }
        });

        return sugerencia;

    } catch (error) {
        console.error('Error al calcular la sugerencia vial:', error);
        return {};
    }
}

module.exports = { calcularSugerenciaVial, parsearSentido, calcularLado };
