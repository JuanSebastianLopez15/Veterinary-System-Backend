-- Migración 9: Ampliar campo contrasena y crear tabla detalle_factura_medicamento

-- 1. Ampliar el campo contrasena para soportar hashes bcrypt (60+ caracteres)
ALTER TABLE usuario ALTER COLUMN contrasena TYPE VARCHAR(100);

-- 2. Crear tabla de detalle de medicamentos en factura
CREATE TABLE IF NOT EXISTS detalle_factura_medicamento (
    codigo            VARCHAR(50)  PRIMARY KEY DEFAULT gen_random_uuid(),
    factura_codigo    VARCHAR(50)  NOT NULL REFERENCES factura(codigo),
    producto_codigo   VARCHAR(50)  NOT NULL REFERENCES producto(codigo),
    cantidad          INT          NOT NULL,
    precio_unitario   FLOAT        NOT NULL
);
