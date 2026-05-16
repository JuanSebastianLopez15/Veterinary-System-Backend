-- Uusuario
CREATE TABLE Usuario (
    codigo          VARCHAR(50)  PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre          VARCHAR(50)  NOT NULL,
    apellido        VARCHAR(50)  NOT NULL,
    correo          VARCHAR(70)  NOT NULL UNIQUE,
    contrasena      VARCHAR(20)  NOT NULL,
    rol             VARCHAR(30)  NOT NULL,
    telefono        VARCHAR(10)  NOT NULL,
    estado          VARCHAR(40)  NOT NULL DEFAULT 'pendiente_verificacion',
    creado_en       TIMESTAMP    NOT NULL DEFAULT now()
);

-- Cliente
CREATE TABLE Cliente (
    codigo          VARCHAR(50)  PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_codigo  VARCHAR(50)  NOT NULL UNIQUE REFERENCES Usuario(codigo),
    direccion       VARCHAR(50)  NOT NULL,
    ciudad          VARCHAR(50)  NOT NULL
);

-- !fecha_nacimiento es DATE en vez del varchar que esta en el diagrama. Tambien faltaba el atributo raza.
-- ! Mascotas
CREATE TABLE Mascotas (
    codigo          VARCHAR(50)  PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_codigo  VARCHAR(50)  NOT NULL REFERENCES Cliente(codigo),
    nombre          VARCHAR(50)  NOT NULL,
    especie         VARCHAR(70)  NOT NULL,
    raza            VARCHAR(70)  NOT NULL,
    color           VARCHAR(20)  NOT NULL,
    fecha_nacimiento DATE NOT NULL,
    peso            FLOAT        NOT NULL,
    estado          VARCHAR(20)  NOT NULL DEFAULT 'activa'
);

-- Servicio
CREATE TABLE Servicio (
    codigo          VARCHAR(50)  PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre          VARCHAR(50)  NOT NULL,
    descripcion     VARCHAR(100) NOT NULL,
    precio          FLOAT        NOT NULL,
    estado          VARCHAR(20)  NOT NULL DEFAULT 'activo'
);

-- Producto
CREATE TABLE Producto (
    codigo          VARCHAR(50)  PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre          VARCHAR(100) NOT NULL,
    tipo            VARCHAR(70)  NOT NULL,
    stock           INT          NOT NULL DEFAULT 0,
    stock_minimo    INT          NOT NULL,
    precio          FLOAT        NOT NULL,
    fecha_vencimiento DATE       NOT NULL
);

-- Pago
CREATE TABLE Pago (
    codigo          VARCHAR(50)  PRIMARY KEY DEFAULT gen_random_uuid(),
    cita_codigo     VARCHAR(50)  NOT NULL,
    monto           FLOAT        NOT NULL,
    metodo_pago     VARCHAR(20)  NOT NULL,
    fecha           DATE         NOT NULL
);

-- Cita
CREATE TABLE Cita (
    codigo              VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_codigo      VARCHAR(50) NOT NULL REFERENCES Usuario(codigo),
    mascota_codigo      VARCHAR(50) NOT NULL REFERENCES Mascotas(codigo),
    cliente_codigo      VARCHAR(50) NOT NULL REFERENCES Cliente(codigo),
    pago_codigo         VARCHAR(50) NOT NULL UNIQUE REFERENCES Pago(codigo),
    fecha               DATE        NOT NULL,
    hora                TIME        NOT NULL,
    estado              VARCHAR(20) NOT NULL DEFAULT 'confirmada',
    motivo_cancelacion  VARCHAR(255),
    total               DECIMAL(10,2) NOT NULL
);

-- !!!!! Aqui hay un detalle y es que PAGO y CITA se refiereencian mutuamente y creo que da problema de orden de creacion, por eso se hace de esta manera. Si no funciona tocaria mirar el diagrama de relaciones.
ALTER TABLE Pago
ADD CONSTRAINT fk_pago_cita
FOREIGN KEY (cita_codigo) REFERENCES Cita(codigo);

-- Cita_Servicios
CREATE TABLE Cita_Servicios (
    codigo          VARCHAR(50)  PRIMARY KEY DEFAULT gen_random_uuid(),
    cita_codigo     VARCHAR(50)  NOT NULL REFERENCES Cita(codigo),
    servicio_codigo VARCHAR(50)  NOT NULL REFERENCES Servicio(codigo),
    nombre          VARCHAR(50)  NOT NULL,
    precio_unitario FLOAT        NOT NULL
);

-- Historial_Medico
CREATE TABLE Historial_Medico (
    codigo              VARCHAR(50)  PRIMARY KEY DEFAULT gen_random_uuid(),
    cita_codigo         VARCHAR(50)  NOT NULL UNIQUE REFERENCES Cita(codigo),
    mascota_codigo      VARCHAR(50)  NOT NULL REFERENCES Mascotas(codigo),
    veterinario_codigo  VARCHAR(50)  NOT NULL REFERENCES Usuario(codigo),
    motivo_visita       VARCHAR(200) NOT NULL,
    diagnostico         VARCHAR(150) NOT NULL,
    tratamiento_aplicado VARCHAR(150) NOT NULL,
    peso_mascota        FLOAT        NOT NULL,
    proxima_visita      DATE,
    editable_hasta      TIMESTAMP    NOT NULL,
    creado_en           TIMESTAMP    NOT NULL DEFAULT now()
);

-- Vacuna
CREATE TABLE Vacuna (
    codigo                  VARCHAR(50)  PRIMARY KEY DEFAULT gen_random_uuid(),
    historial_codigo        VARCHAR(50)  NOT NULL REFERENCES Historial_Medico(codigo),
    mascota_codigo          VARCHAR(50)  NOT NULL REFERENCES Mascotas(codigo),
    nombre                  VARCHAR(100) NOT NULL,
    fecha                   DATE         NOT NULL,
    fecha_siguiente_vacuna  DATE
);

-- Medicamento_Prescrito
CREATE TABLE Medicamento_Prescrito (
    codigo                      VARCHAR(50)  PRIMARY KEY DEFAULT gen_random_uuid(),
    historial_codigo            VARCHAR(50)  NOT NULL REFERENCES Historial_Medico(codigo),
    producto_codigo             VARCHAR(50)  REFERENCES Producto(codigo),
    dosis                       VARCHAR(70)  NOT NULL,
    duracion                    VARCHAR(70)  NOT NULL,
    cantidad_medicamentos_prescritos INT     NOT NULL
);

-- ! Hospitalizacion
CREATE TABLE Hospitalizacion (
    codigo              VARCHAR(50)  PRIMARY KEY DEFAULT gen_random_uuid(),
    mascota_codigo      VARCHAR(50)  NOT NULL REFERENCES Mascotas(codigo),
    veterinario_codigo  VARCHAR(50)  NOT NULL REFERENCES Usuario(codigo),
    fecha_ingreso       DATE         NOT NULL,
    fecha_salida        DATE,
    estado_egreso       VARCHAR(70),
    motivo              VARCHAR(255) NOT NULL,
    activa              BOOLEAN      NOT NULL DEFAULT true
);

-- Nota_Evolucion
CREATE TABLE Nota_Evolucion (
    codigo                  VARCHAR(50)  PRIMARY KEY DEFAULT gen_random_uuid(),
    hospitalizacion_codigo  VARCHAR(50)  NOT NULL REFERENCES Hospitalizacion(codigo),
    veterinario_codigo      VARCHAR(50)  NOT NULL REFERENCES Usuario(codigo),
    fecha                   DATE         NOT NULL DEFAULT CURRENT_DATE,
    descripcion             VARCHAR(500) NOT NULL,
    estado_egreso           VARCHAR(70)
);

-- ! Factura
CREATE TABLE Factura (
    codigo          VARCHAR(50)   PRIMARY KEY DEFAULT gen_random_uuid(),
    cita_codigo     VARCHAR(50)   NOT NULL UNIQUE REFERENCES Cita(codigo),
    cliente_codigo  VARCHAR(50)   NOT NULL REFERENCES Cliente(codigo),
    fecha           DATE          NOT NULL DEFAULT CURRENT_DATE,
    total           DECIMAL(10,2) NOT NULL,
    descuento       DECIMAL(10,2) NOT NULL DEFAULT 0,
    motivo_anulado  VARCHAR(200),
    estado          VARCHAR(20)   NOT NULL DEFAULT 'pendiente',
    prepagado       DECIMAL(10,2) NOT NULL DEFAULT 0,
    saldo_pendiente DECIMAL(10,2) NOT NULL DEFAULT 0
);