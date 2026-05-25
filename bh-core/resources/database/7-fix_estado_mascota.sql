ALTER TABLE mascotas DROP CONSTRAINT chk_mascota_estado;
ALTER TABLE mascotas ADD CONSTRAINT chk_mascota_estado
    CHECK (estado IN ('activa', 'hospitalizada', 'fallecida', 'inactiva'));