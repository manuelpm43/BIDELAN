const express = require('express');
const pool = require('./db');
const exigirEditor = require('./middlewareEditor');

const router = express.Router();

router.use(exigirEditor);

router.get('/capas', manejarListarCapas);
router.post('/:tabla', manejarCrear);
router.put('/:tabla/:pk', manejarActualizar);
router.delete('/:tabla/:pk', manejarEliminar);

/**
 * Busca una capa en el registro de capas editables. Nunca se debe
 * interpolar en SQL el nombre de tabla que llega en la URL sin pasar
 * antes por aquí: solo se usa capa.nombre_tabla (el valor ya leído de
 * la base de datos), no el parámetro tal cual lo mandó el cliente.
 */
async function buscarCapaEditable(nombreTabla) {
    const resultado = await pool.query(
        'SELECT * FROM capas_editables WHERE nombre_tabla = $1 AND activa = true',
        [nombreTabla]
    );

    return resultado.rows[0] || null;
}

// El visor siempre manda coordenadas en la proyección del mapa (3857). Si
// la tabla destino tiene otro SRID nativo (p.ej. pk_v0 está en 25830), hay
// que reproyectar al guardar; si coincide, ST_Transform no hace nada.
const SRID_MAPA = 3857;

function expresionGeometria(capa, indiceParametro) {
    const base = `ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($${indiceParametro}), ${SRID_MAPA}), ${capa.srid})`;
    return capa.tipo_geometria.startsWith('Multi') ? `ST_Multi(${base})` : base;
}

/**
 * Filtra el objeto de atributos recibido a solo los campos que la capa
 * tiene marcados como editables, en el mismo orden que campos_editables.
 */
function camposPresentes(capa, atributos) {
    const nombresPermitidos = capa.campos_editables.map(function (c) { return c.campo; });

    return nombresPermitidos.filter(function (nombre) {
        return Object.prototype.hasOwnProperty.call(atributos || {}, nombre);
    });
}

async function manejarListarCapas(req, res) {
    try {
        const resultado = await pool.query(
            'SELECT nombre_tabla, etiqueta, campo_pk, campo_geometria, tipo_geometria, srid, campos_editables FROM capas_editables WHERE activa = true'
        );

        res.json(resultado.rows);

    } catch (error) {
        console.error('Error al listar capas editables:', error);
        res.status(500).json({ mensaje: 'No se ha podido obtener la lista de capas editables.' });
    }
}

async function manejarCrear(req, res) {
    const { tabla } = req.params;
    const { atributos, geometria } = req.body;

    try {
        const capa = await buscarCapaEditable(tabla);

        if (!capa) {
            return res.status(404).json({ mensaje: 'Esa capa no está disponible para edición.' });
        }

        const campos = camposPresentes(capa, atributos);
        const columnas = [capa.campo_pk, ...campos];
        const parametros = [];
        let n = 1;

        const placeholderPk = `(SELECT COALESCE(MAX("${capa.campo_pk}"), 0) + 1 FROM public."${capa.nombre_tabla}")`;
        const placeholders = [placeholderPk];

        campos.forEach(function (campo) {
            placeholders.push(`$${n++}`);
            parametros.push(atributos[campo]);
        });

        if (geometria) {
            columnas.push(capa.campo_geometria);
            placeholders.push(expresionGeometria(capa, n));
            parametros.push(JSON.stringify(geometria));
            n++;
        }

        const columnasSql = columnas.map(function (c) { return `"${c}"`; }).join(', ');

        const resultado = await pool.query(
            `INSERT INTO public."${capa.nombre_tabla}" (${columnasSql}) VALUES (${placeholders.join(', ')}) RETURNING "${capa.campo_pk}"`,
            parametros
        );

        const pk = resultado.rows[0][capa.campo_pk];

        await registrarAuditoria(req.usuario, capa.nombre_tabla, 'crear', pk, null, { atributos, geometria });

        res.status(201).json({ [capa.campo_pk]: pk });

    } catch (error) {
        console.error('Error al crear elemento:', error);
        res.status(500).json({ mensaje: 'No se ha podido crear el elemento.' });
    }
}

async function manejarActualizar(req, res) {
    const { tabla, pk } = req.params;
    const { atributos, geometria } = req.body;

    try {
        const capa = await buscarCapaEditable(tabla);

        if (!capa) {
            return res.status(404).json({ mensaje: 'Esa capa no está disponible para edición.' });
        }

        const antes = await pool.query(
            `SELECT * FROM public."${capa.nombre_tabla}" WHERE "${capa.campo_pk}" = $1`,
            [pk]
        );

        if (antes.rows.length === 0) {
            return res.status(404).json({ mensaje: 'No existe ningún elemento con ese identificador.' });
        }

        const campos = camposPresentes(capa, atributos);
        const asignaciones = [];
        const parametros = [];
        let n = 1;

        campos.forEach(function (campo) {
            asignaciones.push(`"${campo}" = $${n++}`);
            parametros.push(atributos[campo]);
        });

        if (geometria) {
            asignaciones.push(`"${capa.campo_geometria}" = ${expresionGeometria(capa, n)}`);
            parametros.push(JSON.stringify(geometria));
            n++;
        }

        if (asignaciones.length === 0) {
            return res.status(400).json({ mensaje: 'No se ha indicado ningún cambio.' });
        }

        parametros.push(pk);

        await pool.query(
            `UPDATE public."${capa.nombre_tabla}" SET ${asignaciones.join(', ')} WHERE "${capa.campo_pk}" = $${n}`,
            parametros
        );

        await registrarAuditoria(req.usuario, capa.nombre_tabla, 'actualizar', pk, antes.rows[0], { atributos, geometria });

        res.json({ mensaje: 'Elemento actualizado.' });

    } catch (error) {
        console.error('Error al actualizar elemento:', error);
        res.status(500).json({ mensaje: 'No se ha podido actualizar el elemento.' });
    }
}

async function manejarEliminar(req, res) {
    const { tabla, pk } = req.params;

    try {
        const capa = await buscarCapaEditable(tabla);

        if (!capa) {
            return res.status(404).json({ mensaje: 'Esa capa no está disponible para edición.' });
        }

        const antes = await pool.query(
            `SELECT * FROM public."${capa.nombre_tabla}" WHERE "${capa.campo_pk}" = $1`,
            [pk]
        );

        if (antes.rows.length === 0) {
            return res.status(404).json({ mensaje: 'No existe ningún elemento con ese identificador.' });
        }

        await pool.query(
            `DELETE FROM public."${capa.nombre_tabla}" WHERE "${capa.campo_pk}" = $1`,
            [pk]
        );

        await registrarAuditoria(req.usuario, capa.nombre_tabla, 'eliminar', pk, antes.rows[0], null);

        res.json({ mensaje: 'Elemento eliminado.' });

    } catch (error) {
        console.error('Error al eliminar elemento:', error);
        res.status(500).json({ mensaje: 'No se ha podido eliminar el elemento.' });
    }
}

async function registrarAuditoria(usuario, tabla, operacion, featurePk, datosAntes, datosDespues) {
    await pool.query(
        `INSERT INTO auditoria_edicion (tabla, operacion, feature_pk, usuario_id, usuario_email, datos_antes, datos_despues)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
            tabla,
            operacion,
            String(featurePk),
            usuario.id,
            usuario.email,
            datosAntes ? JSON.stringify(datosAntes) : null,
            datosDespues ? JSON.stringify(datosDespues) : null
        ]
    );
}

module.exports = router;
