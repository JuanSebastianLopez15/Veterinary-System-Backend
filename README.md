# Breaze & Harold Veterinary System

Sistema de gestión clínica veterinaria para **B&H**

## Arquitectura

El sistema está compuesto por dos servicios independientes, cada uno con su propia base de datos:

| Servicio | Descripción |
|---|---|
| `bh-core` | Sistema principal. esta toda la operación clínica: usuarios, mascotas, citas, historiales, inventario, facturación y reportes. |
| `bh-audit` | Servicio de trazabilidad. Recibe y almacena eventos de `bh-core`. Opera de forma completamente independiente. |

La comunicación entre servicios ocurre dentro del clúster (Kubernetes). `bh-audit` no expone rutas al exterior — solo recibe notificaciones internas de `bh-core`. Si `bh-audit` no está disponible, `bh-core` sigue operando con normalidad.

---

## Stack 

| Capa | Tecnología |
|---|---|
| Framework | [NestJS](https://nestjs.com/) |
| Lenguaje | TypeScript |
| Base de datos | PostgreSQL |
| ORM | TypeORM |
| Autenticación | JWT (JSON Web Tokens) |
| Documentación API | OpenAPI 3.0 / Swagger |
| Contenedores | Docker |
| Orquestación | Kubernetes |
---

## Roles

| Rol | Descripción |
|---|---|
| `cliente` | Dueño de mascota. Consulta citas, historial médico y descarga facturas. |
| `recepcionista` | Agenda citas, registra clientes y mascotas, genera facturas. |
| `veterinario` | Atiende citas, registra diagnósticos, aplica vacunas, interna mascotas. |
| `administrador` | Gestiona inventario, catálogo de servicios, usuarios y reportes. |

---

## Condiciones de trabajo


- **Conventional Commits:** todos los mensajes de commit siguen la convención (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).

- **Pull Requests:** todo cambio requiere revisión de al menos un compañero antes de hacer merge.

- **Nomenclatura de ramas:** `feature/BH-<número>-<descripción-corta>` — ejemplo: `feature/BH-12-registro-historial-medico`.

---

## Convención de commits

```
feat:     Nueva funcionalidad
fix:      Corrección de error
docs:     Cambios en documentación
refactor: Refactorización sin cambio de comportamiento
test:     Adición o modificación de pruebas
chore:    Tareas de configuración o mantenimiento
```

---
