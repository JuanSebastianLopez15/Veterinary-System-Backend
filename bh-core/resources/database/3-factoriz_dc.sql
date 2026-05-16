--Ayuda con las dependencias de cita y pago por ejemplo, agrega restricciones CHECK(para validar datos antes de guardarse en la BD)
-- Resolver dependencia circular Cita <-> Pago, se elimina pago_codigo de Cita. La relacion queda en Pago.cita_codigo (UNIQUE).
ALTER TABLE Cita DROP CONSTRAINT IF EXISTS cita_pago_codigo_fkey;
ALTER TABLE Cita DROP COLUMN  IF EXISTS pago_codigo;

--Usuario: CHECK sobre rol y estado
ALTER TABLE Usuario DROP CONSTRAINT IF EXISTS chk_usuario_rol;
ALTER TABLE Usuario ADD  CONSTRAINT chk_usuario_rol
    CHECK (rol IN ('ADMIN', 'VETERINARIO', 'CLIENTE'));
ALTER TABLE Usuario DROP CONSTRAINT IF EXISTS chk_usuario_estado;
ALTER TABLE Usuario ADD  CONSTRAINT chk_usuario_estado
    CHECK (estado IN ('activo', 'inactivo', 'pendiente_verificacion'));
--aplia la contrasena
ALTER TABLE Usuario ALTER COLUMN contrasena TYPE VARCHAR(255);

-- CHECK sobre el estado
ALTER TABLE Mascotas DROP CONSTRAINT IF EXISTS chk_mascota_estado;
ALTER TABLE Mascotas ADD  CONSTRAINT chk_mascota_estado
    CHECK (estado IN ('activa', 'inactiva', 'fallecida'));
ALTER TABLE Cita DROP CONSTRAINT IF EXISTS chk_cita_estado;
ALTER TABLE Cita ADD  CONSTRAINT chk_cita_estado
    CHECK (estado IN ('pendiente', 'confirmada', 'completada', 'cancelada'));
ALTER TABLE Servicio DROP CONSTRAINT IF EXISTS chk_servicio_estado;
ALTER TABLE Servicio ADD  CONSTRAINT chk_servicio_estado
    CHECK (estado IN ('activo', 'inactivo'));

--CHECK sobre metodo_de_pago
ALTER TABLE Pago DROP CONSTRAINT IF EXISTS chk_pago_metodo;
ALTER TABLE Pago ADD  CONSTRAINT chk_pago_metodo
    CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'transferencia', 'otro'));
ALTER TABLE Factura DROP CONSTRAINT IF EXISTS chk_factura_estado;
ALTER TABLE Factura ADD  CONSTRAINT chk_factura_estado
    CHECK (estado IN ('pendiente', 'pagada', 'anulada'));

--Actualiza datos y los vuelve compatibles con el CHECK
UPDATE Factura SET estado = 'pagada'    WHERE estado NOT IN ('pendiente', 'pagada', 'anulada');
UPDATE Cita    SET estado = 'confirmada' WHERE estado NOT IN ('pendiente', 'confirmada', 'completada', 'cancelada');