-- 
CREATE TABLE Registro_Accion (
    codigo          VARCHAR(50)  PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_usuario  VARCHAR(50)  NOT NULL,
    nombre          VARCHAR(50)  NOT NULL,
    apellido        VARCHAR(50)  NOT NULL,
    rol             VARCHAR(30)  NOT NULL,
    fecha           DATE         NOT NULL DEFAULT CURRENT_DATE,
    hora_inicio     TIME         NOT NULL DEFAULT CURRENT_TIME,
    hora_fin        TIME
);