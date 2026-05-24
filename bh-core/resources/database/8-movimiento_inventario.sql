-- SCRUM-98: Inventory movements + service catalog activation flag

-- Allow product expiration date to be optional (some non-perishable items)
ALTER TABLE Producto
    ALTER COLUMN fecha_vencimiento DROP NOT NULL;

-- Inventory movements: every stock change (manual or prescription) leaves a trace
CREATE TABLE IF NOT EXISTS movimiento_inventario (
    codigo          VARCHAR(50)  PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_codigo VARCHAR(50)  NOT NULL REFERENCES Producto(codigo),
    tipo            VARCHAR(40)  NOT NULL,
    cantidad        INT          NOT NULL,
    motivo          VARCHAR(255),
    creado_por      VARCHAR(50),
    creado_en       TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movimiento_inventario_producto
    ON movimiento_inventario (producto_codigo);
