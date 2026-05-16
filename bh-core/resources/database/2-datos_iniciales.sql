--Usuarios
INSERT INTO Usuario (codigo, nombre, apellido, correo, contrasena, rol, telefono, estado) VALUES
('usr-adm-01', 'Sofia',     'Restrepo',  'admin@bhcore.com',              'Admin2024!',  'ADMIN',       '3001112233', 'activo'),
('usr-vet-01', 'Andres',    'Montoya',   'andres.montoya@bhcore.com',     'Vet12345!',   'VETERINARIO', '3009988776', 'activo'),
('usr-vet-02', 'Valentina', 'Cardenas',  'v.cardenas@bhcore.com',         'Vet67890!',   'VETERINARIO', '3017865432', 'activo'),
('usr-cli-01', 'Carlos',    'Martinez',  'carlos.martinez@gmail.com',     'Cli2024!',    'CLIENTE',     '3103334455', 'activo'),
('usr-cli-02', 'Laura',     'Gonzalez',  'laura.gonzalez@gmail.com',      'Cli2024!',    'CLIENTE',     '3204445566', 'activo');

-- Clientes
INSERT INTO Cliente (codigo, usuario_codigo, direccion, ciudad) VALUES
('cli-01', 'usr-cli-01', 'Cra 23 #45-10', 'Manizales'),
('cli-02', 'usr-cli-02', 'Cll 50 #12-80', 'Pereira');

-- Mascotas
INSERT INTO Mascotas (codigo, cliente_codigo, nombre, especie, raza, color, fecha_nacimiento, peso, estado) VALUES
('msc-01', 'cli-01', 'Rocky', 'Perro', 'Labrador Retriever',  'Amarillo', '2020-03-15', 28.5, 'activa'),
('msc-02', 'cli-01', 'Luna',  'Gato',  'Siames',              'Blanco',   '2021-07-20',  4.2, 'activa'),
('msc-03', 'cli-02', 'Max',   'Perro', 'Golden Retriever',    'Dorado',   '2019-11-05', 32.0, 'activa'),
('msc-04', 'cli-02', 'Mia',   'Gato',  'Persa',               'Gris',     '2022-01-10',  3.8, 'activa');

-- Servicios
INSERT INTO Servicio (codigo, nombre, descripcion, precio, estado) VALUES
('srv-01', 'Consulta General',  'Revision general del estado de salud de la mascota',      50000.00, 'activo'),
('srv-02', 'Vacunacion',        'Aplicacion de vacunas segun esquema vacunal vigente',     35000.00, 'activo'),
('srv-03', 'Bano y Peluqueria', 'Servicio completo de higiene y estetica para mascotas',   45000.00, 'activo'),
('srv-04', 'Desparasitacion',   'Tratamiento antiparasitario interno y externo',            30000.00, 'activo'),
('srv-05', 'Cirugia Menor',     'Procedimientos quirurgicos de baja complejidad',          200000.00, 'activo');

-- Productos
INSERT INTO Producto (codigo, nombre, tipo, stock, stock_minimo, precio, fecha_vencimiento) VALUES
('prd-01', 'Vacuna Antirrabica',        'Vacuna',           50, 10,  25000.00, '2026-12-31'),
('prd-02', 'Vacuna Polivalente Canina', 'Vacuna',           40, 10,  32000.00, '2026-08-15'),
('prd-03', 'Amoxicilina 500mg',         'Antibiotico',     100, 20,   8000.00, '2026-06-30'),
('prd-04', 'Metronidazol 250mg',        'Antibiotico',      80, 15,   6500.00, '2026-09-20'),
('prd-05', 'Omeprazol Veterinario',     'Gastroprotector',  60, 12,  12000.00, '2026-11-10'),
('prd-06', 'Antiparasitario Externo',   'Antiparasitario',  75, 15,  18000.00, '2027-02-28');

-- Citas y Pagos (depende una de la otra)
SET session_replication_role = replica;
INSERT INTO Cita (codigo, usuario_codigo, mascota_codigo, cliente_codigo, pago_codigo, fecha, hora, estado, total) VALUES
('cit-01', 'usr-vet-01', 'msc-01', 'cli-01', 'pag-01', '2024-06-10', '09:00:00', 'confirmada', 85000.00),
('cit-02', 'usr-vet-02', 'msc-03', 'cli-02', 'pag-02', '2024-06-12', '14:30:00', 'confirmada', 80000.00),
('cit-03', 'usr-vet-01', 'msc-02', 'cli-01', 'pag-03', '2024-06-15', '10:00:00', 'confirmada', 50000.00);
INSERT INTO Pago (codigo, cita_codigo, monto, metodo_pago, fecha) VALUES
('pag-01', 'cit-01', 85000.00, 'efectivo',      '2024-06-10'),
('pag-02', 'cit-02', 80000.00, 'tarjeta',       '2024-06-12'),
('pag-03', 'cit-03', 50000.00, 'transferencia', '2024-06-15');
SET session_replication_role = DEFAULT;

-- Cita_Servicios
INSERT INTO Cita_Servicios (codigo, cita_codigo, servicio_codigo, nombre, precio_unitario) VALUES
('cs-01', 'cit-01', 'srv-01', 'Consulta General',  50000.00),
('cs-02', 'cit-01', 'srv-02', 'Vacunacion',        35000.00),
('cs-03', 'cit-02', 'srv-01', 'Consulta General',  50000.00),
('cs-04', 'cit-02', 'srv-04', 'Desparasitacion',   30000.00),
('cs-05', 'cit-03', 'srv-01', 'Consulta General',  50000.00);

-- Historial Medico
INSERT INTO Historial_Medico (codigo, cita_codigo, mascota_codigo, veterinario_codigo, motivo_visita, diagnostico, tratamiento_aplicado, peso_mascota, proxima_visita, editable_hasta) VALUES
('hm-01', 'cit-01', 'msc-01', 'usr-vet-01','Vacunacion anual y revision general','Mascota en buen estado de salud. Sin hallazgos clinicos relevantes.','Aplicacion de vacuna polivalente y antirrabica. Dieta balanceada recomendada.',28.5, '2025-06-10', '2024-06-17 23:59:59'),
('hm-02', 'cit-02', 'msc-03', 'usr-vet-02','Perdida de apetito y vomito ocasional desde hace 3 dias','Gastroenteritis leve sin complicaciones sistemicas','Se prescribe metronidazol 250mg cada 12h por 7 dias y dieta blanda.',31.8, '2024-06-26', '2024-06-19 23:59:59'),
('hm-03', 'cit-03', 'msc-02', 'usr-vet-01','Consulta de rutina y revision dental','Estado de salud optimo. Presencia de leve sarro dental.','Limpieza dental superficial. Se recomienda limpieza profunda en 6 meses.',4.2, '2024-12-15', '2024-06-22 23:59:59');

-- Vacunas
INSERT INTO Vacuna (codigo, historial_codigo, mascota_codigo, nombre, fecha, fecha_siguiente_vacuna) VALUES
('vac-01', 'hm-01', 'msc-01', 'Vacuna Antirrabica',        '2024-06-10', '2025-06-10'),
('vac-02', 'hm-01', 'msc-01', 'Vacuna Polivalente Canina', '2024-06-10', '2025-06-10');

-- Medicamentos Prescritos
INSERT INTO Medicamento_Prescrito (codigo, historial_codigo, producto_codigo, dosis, duracion, cantidad_medicamentos_prescritos) VALUES
('mp-01', 'hm-02', 'prd-04', '1 tableta cada 12 horas', '7 dias', 14);

-- Hospitalizaciones
INSERT INTO Hospitalizacion (codigo, mascota_codigo, veterinario_codigo, fecha_ingreso, fecha_salida, estado_egreso, motivo, activa) VALUES
('hos-01', 'msc-03', 'usr-vet-02','2024-06-12', '2024-06-14', 'Mejorado','Gastroenteritis con deshidratacion moderada que requiere fluidoterapia IV.',false);

-- Notas de Evolucion
INSERT INTO Nota_Evolucion (codigo, hospitalizacion_codigo, veterinario_codigo, fecha, descripcion, estado_egreso) VALUES
('ne-01', 'hos-01', 'usr-vet-02', '2024-06-12','Mascota ingresa con vomito frecuente y deshidratacion del 7%. Se inicia fluidoterapia IV a 60ml/kg/dia.',NULL),
('ne-02', 'hos-01', 'usr-vet-02', '2024-06-13','Mejoria notable en hidratacion. Tolera agua sin vomito. Se introduce dieta blanda en pequenas porciones.',NULL),
('ne-03', 'hos-01', 'usr-vet-02', '2024-06-14','Paciente estable, come con normalidad y tolera alimento. Se firma alta medica con tratamiento oral en casa.','Mejorado');

-- Facturas
INSERT INTO Factura (codigo, cita_codigo, cliente_codigo, fecha, total, descuento, estado, prepagado, saldo_pendiente) VALUES
('fac-01', 'cit-01', 'cli-01', '2024-06-10', 85000.00,  0.00, 'pagada', 85000.00, 0.00),
('fac-02', 'cit-02', 'cli-02', '2024-06-12', 80000.00,  0.00, 'pagada', 80000.00, 0.00),
('fac-03', 'cit-03', 'cli-01', '2024-06-15', 50000.00, 5000.00,'pagada', 50000.00, 0.00);