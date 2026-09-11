-- Añade el flujo de aprobación de altas: los usuarios nuevos entran como
-- pendientes y no pueden iniciar sesión hasta que un administrador los apruebe.

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rol VARCHAR(20) NOT NULL DEFAULT 'usuario';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS aprobado BOOLEAN NOT NULL DEFAULT false;

-- Ejecutar a mano, una vez, para convertir tu propia cuenta en administrador:
-- UPDATE usuarios SET rol = 'admin', aprobado = true WHERE email = 'tu_email@ejemplo.com';
