-- Ampliar constraint de roles para incluir RECEPCIONISTA
ALTER TABLE Usuario DROP CONSTRAINT IF EXISTS chk_usuario_rol;
ALTER TABLE Usuario ADD CONSTRAINT chk_usuario_rol
    CHECK (rol IN ('ADMIN', 'VETERINARIO', 'CLIENTE', 'RECEPCIONISTA'));

-- Ampliar constraint de estados para incluir todos los estados necesarios
ALTER TABLE Usuario DROP CONSTRAINT IF EXISTS chk_usuario_estado;
ALTER TABLE Usuario ADD CONSTRAINT chk_usuario_estado
    CHECK (estado IN ('activo', 'inactivo', 'pendiente_verificacion', 'pendiente_aprobacion', 'rechazado', 'suspendido'));

-- Agregar columnas para verificación de correo
ALTER TABLE Usuario ADD COLUMN IF NOT EXISTS codigo_verificacion VARCHAR(10);
ALTER TABLE Usuario ADD COLUMN IF NOT EXISTS codigo_verificacion_expira_en TIMESTAMP;
