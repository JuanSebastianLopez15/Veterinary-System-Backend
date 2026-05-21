# BH Core - Veterinary System Backend

Servicio principal del sistema veterinario **Breaze & Harold**. Gestiona la autenticacion de usuarios, control de acceso por roles, administracion de cuentas, clientes, citas, inventario, servicios e historial medico. Construido con **NestJS**, **PostgreSQL** y **JWT**.

---

## Tabla de Contenidos

- [Requisitos Previos](#requisitos-previos)
- [Instalacion](#instalacion)
- [Configuracion del Entorno](#configuracion-del-entorno)
- [Configuracion de la Base de Datos](#configuracion-de-la-base-de-datos)
- [Ejecucion del Proyecto](#ejecucion-del-proyecto)
- [Endpoints Implementados](#endpoints-implementados)
  - [Auth - Autenticacion](#auth---autenticacion)
  - [Users - Gestion de Usuarios](#users---gestion-de-usuarios)
  - [Clientes](#clientes)
  - [Appointments - Citas](#appointments---citas)
  - [Services - Servicios](#services---servicios)
  - [Inventory - Inventario](#inventory---inventario)
  - [Medical Records - Historial Medico](#medical-records---historial-medico)
- [Roles y Estados](#roles-y-estados)
- [Cuenta Admin por Defecto](#cuenta-admin-por-defecto)

---

## Requisitos Previos

Antes de ejecutar el proyecto asegurate de tener instalado lo siguiente:

| Herramienta        | Version Recomendada | Descarga                                    |
|--------------------|---------------------|---------------------------------------------|
| Node.js            | 18 o superior       | https://nodejs.org                          |
| npm                | 9 o superior        | Incluido con Node.js                        |
| PostgreSQL         | 14 o superior       | https://www.postgresql.org/download         |
| pgAdmin (opcional) | Cualquiera          | https://www.pgadmin.org                     |

---

## Instalacion

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-organizacion/Veterinary-System-Backend.git
cd Veterinary-System-Backend/bh-core
```

### 2. Instalar dependencias

```bash
npm install
```

---

## Configuracion del Entorno

Crea un archivo `.env` en la raiz de la carpeta `bh-core/` con el siguiente contenido. Reemplaza los valores segun tu configuracion local:

```env
# Puerto en el que corre el servidor
PORT=3000

# Configuracion de PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bh_core_db
DB_USER=postgres
DB_PASSWORD=postgres
DATABASE_URL=postgres://postgres:postgres@localhost:5432/bh_core_db

# URL del servicio de auditoria (bh-audit)
AUDIT_URL=http://localhost:3001/api/v1/audit/events

# Configuracion de correo Gmail para envio de codigos de verificacion
# Usa una contrasena de aplicacion de Gmail (no la contrasena normal de tu cuenta)
MAIL_USER=tu_correo@gmail.com
MAIL_PASS=xxxx_xxxx_xxxx_xxxx
MAIL_FROM=tu_correo@gmail.com

# JWT - Secreto y tiempo de expiracion del token
JWT_SECRET=bh_core_secret_2026
JWT_EXPIRES_IN=8h
```

### Variables importantes

| Variable         | Descripcion                                                                  |
|------------------|------------------------------------------------------------------------------|
| `DB_NAME`        | Nombre de la base de datos que debes crear en PostgreSQL                     |
| `DB_USER`        | Usuario de PostgreSQL                                                         |
| `DB_PASSWORD`    | Contrasena del usuario de PostgreSQL                                          |
| `MAIL_USER`      | Correo Gmail desde el que se envian los codigos de verificacion               |
| `MAIL_PASS`      | Contrasena de aplicacion de Gmail (no la contrasena normal de tu cuenta)     |
| `JWT_SECRET`     | Cadena secreta para firmar los tokens JWT (cambiar en produccion)            |
| `JWT_EXPIRES_IN` | Tiempo de vida del token JWT (ej: `8h`, `1d`, `30m`)                        |

### Como obtener la contrasena de aplicacion de Gmail

1. Ingresa a tu cuenta de Google
2. Ve a **Seguridad** > **Verificacion en dos pasos** (debe estar activa)
3. Ve a **Contrasenas de aplicaciones**
4. Selecciona aplicacion: **Correo** / dispositivo: **Windows**
5. Copia la contrasena generada (16 caracteres) y pegala en `MAIL_PASS`

---

## Configuracion de la Base de Datos

### 1. Crear la base de datos

En pgAdmin o en la terminal de PostgreSQL ejecuta:

```sql
CREATE DATABASE bh_core_db;
```

### 2. Ejecutar las migraciones

Las migraciones crean todas las tablas y cargan los datos iniciales del sistema:

```bash
npm run migrate
```

Las migraciones se encuentran en `resources/database/` y se ejecutan en orden:

| Archivo                               | Descripcion                                     |
|---------------------------------------|-------------------------------------------------|
| `1-crear_tablas.sql`                  | Crea todas las tablas del sistema               |
| `2-datos_iniciales.sql`               | Inserta datos de prueba y el usuario ADMIN      |
| `3-factoriz_dc.sql`                   | Ajustes de facturacion                          |
| `4-agregar_creado_en_producto.sql`    | Agrega campo `creado_en` a la tabla Producto    |
| `5-agregar_timestamps_servicio.sql`   | Agrega timestamps a la tabla Servicio           |
| `6-agregar_verificacion_usuario.sql`  | Agrega campos de verificacion de correo         |

---

## Ejecucion del Proyecto

### Modo desarrollo (con hot reload)

```bash
npm run start:dev
```

### Modo produccion

```bash
npm run build
npm run start:prod
```

El servidor quedara disponible en: `http://localhost:3000`

La URL base de todos los endpoints es: `http://localhost:3000/api/v1`

---

## Endpoints Implementados

---

### Auth - Autenticacion

Ruta base: `/api/v1/auth`
Todos los endpoints de auth son **publicos** (no requieren token).

---

#### POST /api/v1/auth/register

Registra un nuevo usuario en el sistema. Despues del registro se envia un codigo de verificacion de 6 digitos al correo.

**Body (JSON):**

```json
{
  "nombre": "Isabela",
  "apellido": "Quintero",
  "correo": "isabela@gmail.com",
  "contrasena": "Segura123",
  "telefono": "3001234567",
  "rol": "CLIENTE"
}
```

| Campo        | Tipo   | Requerido | Descripcion                                              |
|--------------|--------|-----------|----------------------------------------------------------|
| `nombre`     | string | Si        | Solo letras, entre 3 y 50 caracteres, sin espacios       |
| `apellido`   | string | Si        | Solo letras, entre 3 y 50 caracteres, sin espacios       |
| `correo`     | string | Si        | Formato valido (usuario@dominio.com), max 70 caracteres  |
| `contrasena` | string | Si        | Min 8, max 50 chars, una mayuscula, minuscula y numero   |
| `telefono`   | string | Si        | Exactamente 10 digitos, debe iniciar con 3               |
| `rol`        | string | Si        | `CLIENTE`, `RECEPCIONISTA` o `VETERINARIO`               |

**Respuesta exitosa (201 Created):**

```json
{
  "codigo": "550e8400-e29b-41d4-a716-446655440000",
  "nombre": "Isabela",
  "apellido": "Quintero",
  "correo": "isabela@gmail.com",
  "rol": "CLIENTE",
  "estado": "pendiente_verificacion",
  "creadoEn": "21/05/2026, 10:30 a. m."
}
```

| Codigo | Descripcion                                            |
|--------|--------------------------------------------------------|
| 400    | Campo faltante, formato invalido o validacion fallida  |
| 409    | Ya existe un usuario con ese correo                    |

---

#### POST /api/v1/auth/verify-email

Verifica el correo del usuario con el codigo de 6 digitos recibido. El codigo expira a los 15 minutos.

**Body (JSON):**

```json
{
  "correo": "isabela@gmail.com",
  "codigo": "482910"
}
```

| Campo    | Tipo   | Requerido | Descripcion                             |
|----------|--------|-----------|-----------------------------------------|
| `correo` | string | Si        | Correo registrado                       |
| `codigo` | string | Si        | Codigo de 6 digitos recibido al correo  |

**Respuesta exitosa para CLIENTE (200 OK):**

```json
{
  "mensaje": "Correo verificado exitosamente. Tu cuenta esta activa.",
  "estado": "activo"
}
```

**Respuesta exitosa para RECEPCIONISTA o VETERINARIO (200 OK):**

```json
{
  "mensaje": "Correo verificado exitosamente. Tu cuenta esta pendiente de aprobacion por el administrador.",
  "estado": "pendiente_aprobacion"
}
```

| Codigo | Descripcion                                          |
|--------|------------------------------------------------------|
| 400    | Codigo incorrecto, expirado o cuenta ya verificada   |
| 404    | No existe un usuario con ese correo                  |

---

#### POST /api/v1/auth/resend-verification

Reenvía un nuevo codigo de verificacion al correo. Solo disponible para cuentas en estado `pendiente_verificacion`.

**Body (JSON):**

```json
{
  "correo": "isabela@gmail.com"
}
```

**Respuesta exitosa (200 OK):**

```json
{
  "mensaje": "Se ha enviado un nuevo codigo de verificacion a tu correo. Expira en 15 minutos."
}
```

| Codigo | Descripcion                                               |
|--------|-----------------------------------------------------------|
| 400    | La cuenta no esta en estado pendiente_verificacion        |
| 404    | No existe un usuario con ese correo                       |

---

#### POST /api/v1/auth/login

Inicia sesion con correo y contrasena. Retorna un token JWT. Solo usuarios con estado `activo` pueden iniciar sesion.

**Body (JSON):**

```json
{
  "correo": "isabela@gmail.com",
  "contrasena": "Segura123"
}
```

**Respuesta exitosa (200 OK):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "codigo": "550e8400-e29b-41d4-a716-446655440000",
  "nombre": "Isabela",
  "apellido": "Quintero",
  "correo": "isabela@gmail.com",
  "rol": "CLIENTE"
}
```

| Codigo | Descripcion                                              |
|--------|----------------------------------------------------------|
| 400    | Correo o contrasena faltantes o con formato invalido     |
| 401    | Credenciales incorrectas o cuenta bloqueada/inactiva     |

---

### Users - Gestion de Usuarios

Ruta base: `/api/v1/users`
Todos los endpoints requieren:
- **Header:** `Authorization: Bearer <token>`
- **Rol:** `ADMIN`

---

#### GET /api/v1/users

Retorna el listado completo de usuarios. Permite filtrar por rol y/o estado de forma opcional.

**Query params (opcionales):**

| Parametro | Valores permitidos                                                                              |
|-----------|-------------------------------------------------------------------------------------------------|
| `rol`     | `ADMIN`, `CLIENTE`, `RECEPCIONISTA`, `VETERINARIO`                                             |
| `estado`  | `activo`, `inactivo`, `pendiente_verificacion`, `pendiente_aprobacion`, `rechazado`, `suspendido` |

```
GET /api/v1/users
GET /api/v1/users?rol=CLIENTE
GET /api/v1/users?estado=activo
GET /api/v1/users?rol=VETERINARIO&estado=pendiente_aprobacion
```

**Respuesta exitosa (200 OK):**

```json
{
  "total": 1,
  "usuarios": [
    {
      "codigo": "550e8400-e29b-41d4-a716-446655440000",
      "nombre": "Isabela",
      "apellido": "Quintero",
      "correo": "isabela@gmail.com",
      "rol": "CLIENTE",
      "estado": "activo",
      "creadoEn": "21/05/2026, 10:30 a. m."
    }
  ]
}
```

| Codigo | Descripcion                                   |
|--------|-----------------------------------------------|
| 400    | Valor de filtro `rol` o `estado` no permitido |
| 401    | Token invalido o no proporcionado             |
| 403    | El usuario no tiene rol ADMIN                 |

---

#### GET /api/v1/users/pending

Retorna la lista de recepcionistas y veterinarios pendientes de aprobacion.

**Respuesta exitosa (200 OK):**

```json
{
  "total": 1,
  "usuarios": [
    {
      "codigo": "550e8400-e29b-41d4-a716-446655440000",
      "nombre": "Carlos",
      "apellido": "Perez",
      "correo": "carlos@clinica.com",
      "rol": "VETERINARIO",
      "fechaSolicitud": "21/05/2026, 08:15 a. m."
    }
  ]
}
```

---

#### PATCH /api/v1/users/:id/approve

Aprueba la cuenta de un recepcionista o veterinario pendiente de aprobacion. Cambia el estado a `activo`.

**Respuesta exitosa (200 OK):**

```json
{
  "mensaje": "La cuenta de Carlos Perez ha sido aprobada exitosamente.",
  "codigo": "550e8400-e29b-41d4-a716-446655440000",
  "correo": "carlos@clinica.com",
  "rol": "VETERINARIO",
  "estado": "activo"
}
```

| Codigo | Descripcion                                                              |
|--------|--------------------------------------------------------------------------|
| 400    | UUID invalido, rol no aprobable o cuenta no esta en pendiente_aprobacion |
| 404    | No existe un usuario con ese codigo                                      |

---

#### PATCH /api/v1/users/:id/reject

Rechaza la cuenta de un recepcionista o veterinario pendiente de aprobacion. Cambia el estado a `rechazado`.

**Body (JSON):**

```json
{
  "motivo": "La documentacion presentada no cumple con los requisitos minimos."
}
```

| Campo    | Tipo   | Requerido | Descripcion                             |
|----------|--------|-----------|-----------------------------------------|
| `motivo` | string | Si        | Razon del rechazo, entre 10 y 255 chars |

**Respuesta exitosa (200 OK):**

```json
{
  "mensaje": "La cuenta de Carlos Perez ha sido rechazada.",
  "codigo": "550e8400-e29b-41d4-a716-446655440000",
  "correo": "carlos@clinica.com",
  "rol": "VETERINARIO",
  "estado": "rechazado",
  "motivo": "La documentacion presentada no cumple con los requisitos minimos."
}
```

---

#### PATCH /api/v1/users/:id/suspend

Suspende la cuenta de un usuario activo. Cambia el estado a `suspendido`.

**Body (JSON):**

```json
{
  "motivo": "Comportamiento inadecuado reportado por multiples usuarios del sistema."
}
```

| Campo    | Tipo   | Requerido | Descripcion                                  |
|----------|--------|-----------|----------------------------------------------|
| `motivo` | string | Si        | Razon de la suspension, entre 10 y 255 chars |

**Respuesta exitosa (200 OK):**

```json
{
  "mensaje": "La cuenta de Isabela Quintero ha sido suspendida.",
  "codigo": "550e8400-e29b-41d4-a716-446655440000",
  "correo": "isabela@gmail.com",
  "rol": "CLIENTE",
  "estado": "suspendido",
  "motivo": "Comportamiento inadecuado reportado por multiples usuarios del sistema."
}
```

---

### Clientes

Ruta base: `/api/v1/clientes`
Los endpoints de clientes son **publicos** (no requieren token).

---

#### POST /api/v1/clientes

Registra un nuevo cliente en el sistema. Crea el usuario y el registro de cliente en una sola operacion.

**Body (JSON):**

```json
{
  "nombre": "Carlos",
  "apellido": "Martinez",
  "correo": "carlos@gmail.com",
  "contrasena": "Pass1234",
  "telefono": "3103334455",
  "direccion": "Cra 23 #45-10",
  "ciudad": "Manizales"
}
```

| Campo        | Tipo   | Requerido | Descripcion                    |
|--------------|--------|-----------|--------------------------------|
| `nombre`     | string | Si        | Nombre del cliente             |
| `apellido`   | string | Si        | Apellido del cliente           |
| `correo`     | string | Si        | Correo unico del cliente       |
| `contrasena` | string | Si        | Contrasena de la cuenta        |
| `telefono`   | string | Si        | Numero de telefono             |
| `direccion`  | string | Si        | Direccion del cliente          |
| `ciudad`     | string | Si        | Ciudad de residencia           |

**Respuesta exitosa (201 Created):**

```json
{
  "codigo": "cli-uuid-xxxx",
  "usuarioCodigo": "usr-uuid-xxxx",
  "nombre": "Carlos",
  "apellido": "Martinez",
  "correo": "carlos@gmail.com",
  "telefono": "3103334455",
  "direccion": "Cra 23 #45-10",
  "ciudad": "Manizales"
}
```

| Codigo | Descripcion                              |
|--------|------------------------------------------|
| 400    | Alguno de los campos obligatorios falta  |
| 409    | Ya existe un usuario con ese correo      |

---

#### GET /api/v1/clientes

Retorna la lista completa de clientes registrados, ordenada por nombre.

**Respuesta exitosa (200 OK):**

```json
[
  {
    "codigo": "cli-01",
    "nombre": "Carlos",
    "apellido": "Martinez",
    "telefono": "3103334455"
  }
]
```

---

#### GET /api/v1/clientes/buscar/:nombre

Busca clientes cuyo nombre contenga el texto ingresado (busqueda parcial, sin distincion de mayusculas).

**Parametros de ruta:**

| Parametro | Descripcion                         |
|-----------|-------------------------------------|
| `nombre`  | Texto a buscar en el nombre del cliente |

```
GET /api/v1/clientes/buscar/carlos
```

**Respuesta exitosa (200 OK):**

```json
[
  {
    "codigo": "cli-01",
    "nombre": "Carlos",
    "apellido": "Martinez",
    "telefono": "3103334455"
  }
]
```

---

#### GET /api/v1/clientes/:id

Retorna los datos completos de un cliente por su codigo, incluyendo sus mascotas.

**Respuesta exitosa (200 OK):**

```json
{
  "codigo": "cli-01",
  "nombre": "Carlos",
  "apellido": "Martinez",
  "correo": "carlos@gmail.com",
  "telefono": "3103334455",
  "direccion": "Cra 23 #45-10",
  "ciudad": "Manizales",
  "mascotas": [
    {
      "codigo": "msc-01",
      "nombre": "Rocky",
      "estado": "activa"
    }
  ]
}
```

| Codigo | Descripcion                    |
|--------|--------------------------------|
| 404    | Cliente no encontrado          |

---

#### PATCH /api/v1/clientes/:id

Actualiza los datos de un cliente existente. Todos los campos son opcionales; solo se actualizan los que se envian.

**Body (JSON) — todos los campos opcionales:**

```json
{
  "nombre": "Carlos",
  "apellido": "Martinez",
  "correo": "nuevo@gmail.com",
  "telefono": "3109998877",
  "direccion": "Cll 10 #20-30",
  "ciudad": "Pereira"
}
```

**Respuesta exitosa (200 OK):**

```json
{
  "mensaje": "Cliente actualizado exitosamente"
}
```

| Codigo | Descripcion            |
|--------|------------------------|
| 404    | Cliente no encontrado  |

---

### Appointments - Citas

Ruta base: `/api/v1/appointments`
Los endpoints de citas son **publicos** (no requieren token JWT), pero algunos usan el header `x-user-code` para identificar al cliente autenticado.

---

#### POST /api/v1/appointments

Crea una cita confirmada con pago. Uso interno para recepcionistas o integraciones del sistema.

**Body (JSON):**

```json
{
  "usuarioCodigo": "usr-vet-01",
  "mascotaCodigo": "msc-01",
  "clienteCodigo": "cli-01",
  "fecha": "2026-06-15",
  "hora": "10:00:00",
  "serviciosCodigos": ["srv-01", "srv-02"],
  "metodoPago": "efectivo"
}
```

| Campo              | Tipo     | Requerido | Descripcion                                             |
|--------------------|----------|-----------|---------------------------------------------------------|
| `usuarioCodigo`    | string   | Si        | Codigo UUID del veterinario asignado                    |
| `mascotaCodigo`    | string   | Si        | Codigo UUID de la mascota                               |
| `clienteCodigo`    | string   | Si        | Codigo UUID del cliente                                 |
| `fecha`            | string   | Si        | Fecha de la cita en formato `YYYY-MM-DD`                |
| `hora`             | string   | Si        | Hora de la cita en formato `HH:MM:SS`                   |
| `serviciosCodigos` | string[] | Si        | Arreglo con los codigos UUID de los servicios           |
| `metodoPago`       | string   | Si        | `efectivo`, `tarjeta`, `transferencia` u `otro`         |

**Respuesta exitosa (201 Created):**

```json
{
  "codigo": "cit-uuid-xxxx",
  "total": 85000,
  "estado": "confirmada",
  "servicios": [
    { "codigo": "srv-01", "nombre": "Consulta General", "precioUnitario": 50000 },
    { "codigo": "srv-02", "nombre": "Vacunacion", "precioUnitario": 35000 }
  ],
  "pago": {
    "codigo": "pag-uuid-xxxx",
    "monto": 85000,
    "metodoPago": "efectivo",
    "fecha": "2026-06-15"
  }
}
```

| Codigo | Descripcion                                                        |
|--------|--------------------------------------------------------------------|
| 400    | Campo faltante, formato invalido o metodo de pago no permitido     |
| 409    | El veterinario no tiene disponibilidad en esa fecha y hora         |

---

#### POST /api/v1/appointments/client

Crea una cita desde la cuenta de un cliente autenticado. El `clienteCodigo` se resuelve automaticamente a partir del header `x-user-code`, por lo que no debe enviarse en el body.

**Headers requeridos:**

```
x-user-code: <codigo_uuid_del_usuario_cliente>
```

**Body (JSON):**

```json
{
  "usuarioCodigo": "usr-vet-01",
  "mascotaCodigo": "msc-01",
  "fecha": "2026-06-15",
  "hora": "10:00:00",
  "serviciosCodigos": ["srv-01"],
  "metodoPago": "tarjeta"
}
```

| Campo              | Tipo     | Requerido | Descripcion                                       |
|--------------------|----------|-----------|---------------------------------------------------|
| `usuarioCodigo`    | string   | Si        | Codigo UUID del veterinario asignado              |
| `mascotaCodigo`    | string   | Si        | Codigo UUID de la mascota (debe pertenecer al cliente) |
| `fecha`            | string   | Si        | Fecha en formato `YYYY-MM-DD`                     |
| `hora`             | string   | Si        | Hora en formato `HH:MM:SS`                        |
| `serviciosCodigos` | string[] | Si        | Arreglo con codigos UUID de servicios             |
| `metodoPago`       | string   | Si        | `efectivo`, `tarjeta`, `transferencia` u `otro`   |

**Respuesta exitosa (201 Created):** igual que `POST /appointments`

| Codigo | Descripcion                                                           |
|--------|-----------------------------------------------------------------------|
| 400    | Campo faltante o `clienteCodigo` enviado en el body (no permitido)    |
| 403    | El usuario no tiene cliente asociado o la mascota no le pertenece     |
| 409    | El veterinario no tiene disponibilidad en esa fecha y hora            |

---

#### GET /api/v1/appointments/availability

Consulta si un veterinario tiene disponibilidad en una fecha y hora especificas.

**Query params (todos obligatorios):**

| Parametro       | Descripcion                                    |
|-----------------|------------------------------------------------|
| `usuarioCodigo` | UUID del veterinario                           |
| `fecha`         | Fecha en formato `YYYY-MM-DD`                  |
| `hora`          | Hora en formato `HH:MM:SS`                     |

```
GET /api/v1/appointments/availability?usuarioCodigo=usr-vet-01&fecha=2026-06-15&hora=10:00:00
```

**Respuesta exitosa (200 OK):**

```json
{ "disponible": true }
```

| Codigo | Descripcion                                            |
|--------|--------------------------------------------------------|
| 400    | Falta alguno de los tres parametros obligatorios       |

---

#### GET /api/v1/appointments/daily-agenda

Retorna la agenda diaria de un veterinario con el detalle de cada cita, mascota, cliente y servicios.

**Query params (todos obligatorios):**

| Parametro            | Descripcion                    |
|----------------------|--------------------------------|
| `veterinarioCodigo`  | UUID del veterinario           |
| `fecha`              | Fecha en formato `YYYY-MM-DD`  |

```
GET /api/v1/appointments/daily-agenda?veterinarioCodigo=usr-vet-01&fecha=2026-06-15
```

**Respuesta exitosa (200 OK):**

```json
[
  {
    "cita": {
      "codigo": "cit-uuid-xxxx",
      "fecha": "2026-06-15",
      "hora": "10:00:00"
    },
    "estado": "confirmada",
    "total": 50000,
    "mascota": {
      "codigo": "msc-01",
      "nombre": "Rocky",
      "especie": "Perro",
      "raza": "Labrador Retriever"
    },
    "cliente": {
      "codigo": "cli-01",
      "usuarioCodigo": "usr-cli-01",
      "nombre": "Carlos",
      "apellido": "Martinez",
      "correo": "carlos@gmail.com",
      "ciudad": "Manizales"
    },
    "servicios": [
      { "codigo": "srv-01", "nombre": "Consulta General", "precioUnitario": 50000 }
    ]
  }
]
```

| Codigo | Descripcion                                     |
|--------|-------------------------------------------------|
| 400    | Falta `veterinarioCodigo` o `fecha`             |

---

### Services - Servicios

Ruta base: `/api/v1/services`
Los endpoints de servicios son **publicos** (no requieren token).

---

#### POST /api/v1/services

Crea un nuevo servicio veterinario.

**Body (JSON):**

```json
{
  "name": "Consulta General",
  "description": "Revision general del estado de salud de la mascota",
  "price": 50000
}
```

| Campo         | Tipo   | Requerido | Descripcion                          |
|---------------|--------|-----------|--------------------------------------|
| `name`        | string | Si        | Nombre del servicio, no puede estar vacio |
| `description` | string | Si        | Descripcion del servicio, no puede estar vacia |
| `price`       | number | Si        | Precio del servicio, debe ser >= 0   |

**Respuesta exitosa (201 Created):**

```json
{
  "id": "srv-uuid-xxxx",
  "name": "Consulta General",
  "description": "Revision general del estado de salud de la mascota",
  "price": 50000,
  "isActive": true,
  "createdAt": "2026-05-21T15:30:00.000Z",
  "updatedAt": null
}
```

| Codigo | Descripcion                                   |
|--------|-----------------------------------------------|
| 400    | Campo faltante, vacio o precio negativo        |

---

#### GET /api/v1/services

Retorna todos los servicios. Permite filtrar por estado activo/inactivo.

**Query params (opcionales):**

| Parametro  | Valores     | Descripcion                              |
|------------|-------------|------------------------------------------|
| `isActive` | `true`, `false` | Filtra por servicios activos o inactivos |

```
GET /api/v1/services
GET /api/v1/services?isActive=true
GET /api/v1/services?isActive=false
```

**Respuesta exitosa (200 OK):**

```json
{
  "data": [
    {
      "id": "srv-01",
      "name": "Consulta General",
      "description": "Revision general del estado de salud de la mascota",
      "price": 50000,
      "isActive": true,
      "createdAt": "2026-05-21T15:30:00.000Z",
      "updatedAt": null
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 1,
    "totalPages": 1
  }
}
```

| Codigo | Descripcion                              |
|--------|------------------------------------------|
| 400    | `isActive` tiene un valor distinto de `true` o `false` |

---

#### GET /api/v1/services/:id

Retorna un servicio por su codigo UUID.

**Respuesta exitosa (200 OK):**

```json
{
  "id": "srv-01",
  "name": "Consulta General",
  "description": "Revision general del estado de salud de la mascota",
  "price": 50000,
  "isActive": true,
  "createdAt": "2026-05-21T15:30:00.000Z",
  "updatedAt": null
}
```

| Codigo | Descripcion              |
|--------|--------------------------|
| 404    | Servicio no encontrado   |

---

#### PATCH /api/v1/services/:id

Actualiza los datos de un servicio. Todos los campos son opcionales.

**Body (JSON) — todos los campos opcionales:**

```json
{
  "name": "Consulta Especializada",
  "description": "Revision especializada con examenes adicionales",
  "price": 75000
}
```

**Respuesta exitosa (200 OK):** igual que `GET /services/:id` con los datos actualizados.

| Codigo | Descripcion                            |
|--------|----------------------------------------|
| 400    | Precio negativo                        |
| 404    | Servicio no encontrado                 |

---

#### PATCH /api/v1/services/:id/deactivate

Desactiva un servicio. Cambia su estado a `inactivo`.

**Respuesta exitosa (200 OK):** igual que `GET /services/:id` con `isActive: false`.

| Codigo | Descripcion              |
|--------|--------------------------|
| 404    | Servicio no encontrado   |

---

### Inventory - Inventario

Ruta base: `/api/v1/inventory`
Los endpoints de inventario son **publicos** (no requieren token).

Las categorias validas son: `medicamento`, `vacuna`, `insumo_quirurgico`.

---

#### POST /api/v1/inventory

Registra un nuevo producto en el inventario.

**Body (JSON):**

```json
{
  "name": "Amoxicilina 500mg",
  "category": "medicamento",
  "stock": 100,
  "minStock": 20,
  "price": 8000,
  "expirationDate": "2027-06-30"
}
```

| Campo            | Tipo   | Requerido | Descripcion                                                    |
|------------------|--------|-----------|----------------------------------------------------------------|
| `name`           | string | Si        | Nombre del producto, no puede estar vacio                      |
| `category`       | string | Si        | `medicamento`, `vacuna` o `insumo_quirurgico`                  |
| `stock`          | number | Si        | Cantidad inicial en inventario, entero >= 0                    |
| `minStock`       | number | Si        | Stock minimo antes de alertar, entero >= 0                     |
| `price`          | number | Si        | Precio unitario del producto, debe ser >= 0                    |
| `expirationDate` | string | No        | Fecha de vencimiento en formato `YYYY-MM-DD`                   |

**Respuesta exitosa (201 Created):**

```json
{
  "id": "prd-uuid-xxxx",
  "name": "Amoxicilina 500mg",
  "category": "medicamento",
  "stock": 100,
  "minStock": 20,
  "price": 8000,
  "expirationDate": "2027-06-30",
  "createdAt": "2026-05-21T15:30:00.000Z",
  "isLowStock": false,
  "isNearExpiring": false
}
```

| Codigo | Descripcion                                         |
|--------|-----------------------------------------------------|
| 400    | Campo faltante, categoria invalida o valores negativos |

---

#### GET /api/v1/inventory

Retorna todos los productos del inventario. Permite filtrar por categoria.

**Query params (opcionales):**

| Parametro  | Valores                                        |
|------------|------------------------------------------------|
| `category` | `medicamento`, `vacuna`, `insumo_quirurgico`   |

```
GET /api/v1/inventory
GET /api/v1/inventory?category=vacuna
```

**Respuesta exitosa (200 OK):**

```json
{
  "data": [
    {
      "id": "prd-01",
      "name": "Vacuna Antirrabica",
      "category": "vacuna",
      "stock": 50,
      "minStock": 10,
      "price": 25000,
      "expirationDate": "2026-12-31",
      "createdAt": "2026-05-21T15:30:00.000Z",
      "isLowStock": false,
      "isNearExpiring": false
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 1, "totalPages": 1 }
}
```

---

#### GET /api/v1/inventory/low-stock

Retorna los productos cuyo stock actual es menor al stock minimo configurado. Permite filtrar por categoria.

```
GET /api/v1/inventory/low-stock
GET /api/v1/inventory/low-stock?category=medicamento
```

**Respuesta exitosa (200 OK):** misma estructura que `GET /inventory`.

---

#### GET /api/v1/inventory/expiring

Retorna los productos que vencen en los proximos 30 dias. Permite filtrar por categoria.

```
GET /api/v1/inventory/expiring
GET /api/v1/inventory/expiring?category=vacuna
```

**Respuesta exitosa (200 OK):** misma estructura que `GET /inventory`.

---

#### GET /api/v1/inventory/:id

Retorna un producto por su codigo UUID.

**Respuesta exitosa (200 OK):** mismo objeto que los listados.

| Codigo | Descripcion              |
|--------|--------------------------|
| 404    | Producto no encontrado   |

---

#### PATCH /api/v1/inventory/:id

Actualiza los datos editables de un producto. No permite cambiar `stock` ni `category` directamente. Todos los campos son opcionales.

**Body (JSON) — todos los campos opcionales:**

```json
{
  "name": "Amoxicilina 500mg Forte",
  "price": 9000,
  "minStock": 25,
  "expirationDate": "2028-01-01"
}
```

**Respuesta exitosa (200 OK):** el producto actualizado.

| Codigo | Descripcion                             |
|--------|-----------------------------------------|
| 400    | Precio negativo o minStock no entero    |
| 404    | Producto no encontrado                  |

---

#### PATCH /api/v1/inventory/:id/adjust-stock

Ajusta el stock de un producto sumando o restando una cantidad. Para ingresar stock usa un numero positivo; para descontar, usa un numero negativo.

**Body (JSON):**

```json
{
  "quantity": -5,
  "reason": "Consumo en consulta del 21/05/2026"
}
```

| Campo      | Tipo   | Requerido | Descripcion                                               |
|------------|--------|-----------|-----------------------------------------------------------|
| `quantity` | number | Si        | Entero (positivo para entrada, negativo para salida)      |
| `reason`   | string | Si        | Motivo del ajuste, no puede estar vacio                   |

**Respuesta exitosa (200 OK):** el producto con el stock actualizado.

| Codigo | Descripcion                                             |
|--------|---------------------------------------------------------|
| 400    | Cantidad no entera, motivo vacio o el ajuste dejaria stock negativo |
| 404    | Producto no encontrado                                  |

---

### Medical Records - Historial Medico

Ruta base: `/api/v1/appointments`
Los endpoints de historial medico son **publicos** (no requieren token).

---

#### POST /api/v1/appointments/:appointmentId/medical-records

Crea el historial medico de una cita. Puede incluir prescripciones de medicamentos.

**Parametros de ruta:**

| Parametro       | Descripcion                              |
|-----------------|------------------------------------------|
| `appointmentId` | UUID de la cita a la que pertenece el historial |

**Body (JSON):**

```json
{
  "visitReason": "Vacunacion anual y revision general",
  "diagnosis": "Mascota en buen estado de salud",
  "treatment": "Aplicacion de vacuna polivalente y antirrabica",
  "petWeight": 28.5,
  "nextVisitDate": "2027-06-15",
  "veterinarianId": "usr-vet-01",
  "prescriptions": [
    {
      "medicationName": "Amoxicilina 500mg",
      "dosage": "1 tableta cada 12 horas",
      "duration": "7 dias",
      "inventoryProductId": "prd-03",
      "quantity": 14
    }
  ]
}
```

| Campo                | Tipo     | Requerido | Descripcion                                              |
|----------------------|----------|-----------|----------------------------------------------------------|
| `visitReason`        | string   | Si        | Motivo de la visita                                      |
| `diagnosis`          | string   | Si        | Diagnostico del veterinario                              |
| `treatment`          | string   | Si        | Tratamiento aplicado                                     |
| `petWeight`          | number   | Si        | Peso de la mascota en kg, debe ser > 0                   |
| `nextVisitDate`      | string   | No        | Fecha proxima visita en formato `YYYY-MM-DD`             |
| `veterinarianId`     | string   | Si        | UUID del veterinario que atiende la cita                 |
| `prescriptions`      | array    | No        | Lista de medicamentos prescritos                         |

Cada objeto dentro de `prescriptions`:

| Campo                | Tipo   | Requerido | Descripcion                                          |
|----------------------|--------|-----------|------------------------------------------------------|
| `medicationName`     | string | Si        | Nombre del medicamento                               |
| `dosage`             | string | Si        | Dosis indicada                                       |
| `duration`           | string | Si        | Duracion del tratamiento                             |
| `inventoryProductId` | string | No        | UUID del producto en inventario (si aplica)          |
| `quantity`           | number | No        | Cantidad de medicamentos prescritos (default: 1)     |

**Respuesta exitosa (201 Created):** objeto con los datos del historial medico creado.

| Codigo | Descripcion                                                         |
|--------|---------------------------------------------------------------------|
| 400    | Campo obligatorio faltante, peso invalido o prescripcion incompleta |

---

## Roles y Estados

### Roles disponibles

| Rol              | Descripcion                                           |
|------------------|-------------------------------------------------------|
| `ADMIN`          | Administrador del sistema. Aprueba y gestiona cuentas |
| `VETERINARIO`    | Profesional veterinario que atiende citas             |
| `RECEPCIONISTA`  | Personal de recepcion que gestiona agendas            |
| `CLIENTE`        | Propietario de mascotas                               |

> **Nota:** Los usuarios con rol `ADMIN` no pueden registrarse mediante el endpoint `/register`. Solo existen a traves de los datos iniciales de la base de datos.

### Estados de cuenta

| Estado                    | Descripcion                                                                    |
|---------------------------|--------------------------------------------------------------------------------|
| `pendiente_verificacion`  | Recien registrado, debe verificar su correo                                    |
| `pendiente_aprobacion`    | Correo verificado, esperando aprobacion del ADMIN (solo VETERINARIO y RECEPCIONISTA) |
| `activo`                  | Cuenta activa, puede iniciar sesion                                            |
| `rechazado`               | Cuenta rechazada por el ADMIN                                                  |
| `suspendido`              | Cuenta suspendida por el ADMIN                                                 |
| `inactivo`                | Cuenta desactivada                                                             |

### Flujo de activacion por rol

```
CLIENTE:
  registro → pendiente_verificacion → (verificar correo) → activo

VETERINARIO / RECEPCIONISTA:
  registro → pendiente_verificacion → (verificar correo) → pendiente_aprobacion → (ADMIN aprueba) → activo
```

---

## Cuenta Admin por Defecto

El usuario administrador se carga automaticamente con las migraciones. Usa estas credenciales para iniciar sesion como ADMIN:

| Campo        | Valor               |
|--------------|---------------------|
| `correo`     | `admin@bhcore.com`  |
| `contrasena` | `Admin2024!`        |

> Recuerda cambiar esta contrasena en entornos de produccion.
