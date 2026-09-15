-- Añade el flujo de aprobación de altas: los usuarios nuevos entran como
-- pendientes y no pueden iniciar sesión hasta que un administrador los apruebe.

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rol VARCHAR(20) NOT NULL DEFAULT 'usuario';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS aprobado BOOLEAN NOT NULL DEFAULT false;

-- La cuenta admin inicial ya no requiere un UPDATE manual: si en el .env
-- del backend se rellenan ADMIN_EMAIL/ADMIN_PASSWORD, server.js la crea (o
-- la promueve) automáticamente en cada arranque (ver backend/bootstrapAdmin.js).
-- Alternativa manual si lo prefieres:
-- UPDATE usuarios SET rol = 'admin', aprobado = true WHERE email = 'tu_email@ejemplo.com';
