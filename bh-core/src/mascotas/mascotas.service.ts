import {BadRequestException, Inject, Injectable, Module, NotFoundException} from '@nestjs/common';import { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.provider';
import { AuditService } from '../audit/audit.service';
@Module({
  providers: [MascotasService, AuditService],
})
@Injectable()
export class MascotasService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool,
              private readonly auditService: AuditService,
  ) {}

  /**
   * Registra una nueva mascota y la asocia a un cliente existente.
   * @param body - Datos de la mascota: clienteCodigo, nombre, especie, raza, color, fechaNacimiento, peso
   */
  async registrarMascota(body: any) {
    const { clienteCodigo, nombre, especie, raza, color, fechaNacimiento, peso } = body;

    if (!clienteCodigo || !nombre || !especie || !raza || !color || !fechaNacimiento || !peso) {
      throw new BadRequestException('Todos los campos son obligatorios');
    }

    if (!nombre.trim()) {
      throw new BadRequestException('El nombre no puede estar vacío');
    }

    if (peso <= 0) {
      throw new BadRequestException('El peso debe ser mayor a 0');
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const nacimiento = new Date(fechaNacimiento);
    if (nacimiento > hoy) {
      throw new BadRequestException('La fecha de nacimiento no puede ser futura');
    }

    const { rows: [cliente] } = await this.pool.query(
      `SELECT codigo FROM cliente WHERE codigo = $1`,
      [clienteCodigo],
    );

    if (!cliente) {
      throw new NotFoundException('Cliente no encontrado');
    }

    const { rows: [mascota] } = await this.pool.query(
      `INSERT INTO mascotas (cliente_codigo, nombre, especie, raza, color, fecha_nacimiento, peso, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'activa')
       RETURNING codigo, nombre, especie, raza, color, fecha_nacimiento, peso, estado`,
      [clienteCodigo, nombre, especie, raza, color, fechaNacimiento, peso],
    );

    await this.auditService.emit({
      action: 'CREAR_MASCOTA',
      userId: clienteCodigo,
      userRole: null,
      entityType: 'MASCOTA',
      entityId: mascota.codigo,
      details: {
        nombre,
        especie,
        raza,
        color,
        peso,
      },
    });

    return mascota;
  }

  /**
   * Devuelve los datos de una mascota por su ID.
   * @param id - Código único de la mascota
   */
  async consultarMascotaPorId(id: string) {
    const { rows: [mascota] } = await this.pool.query(
      `SELECT codigo, cliente_codigo, nombre, especie, raza, color, fecha_nacimiento, peso, estado
       FROM mascotas
       WHERE codigo = $1`,
      [id.trim()],
    );

    if (!mascota) {
      throw new NotFoundException('Mascota no encontrada');
    }

    return mascota;
  }

  /**
   * Actualiza los datos de una mascota.
   * Solo se modifican los campos que vienen en el body.
   * @param id - Código único de la mascota
   * @param body - Campos a actualizar (todos opcionales)
   */
  async actualizarMascota(id: string, body: any) {
    const { nombre, especie, raza, color, fechaNacimiento, peso } = body;

    if (peso !== undefined && peso !== null && peso <= 0) {
      throw new BadRequestException('El peso debe ser mayor a 0');
    }

    const { rows: [mascota] } = await this.pool.query(
      `SELECT codigo FROM mascotas WHERE codigo = $1`,
      [id],
    );

    if (!mascota) {
      throw new NotFoundException('Mascota no encontrada');
    }

    await this.pool.query(
      `UPDATE mascotas SET
        nombre           = COALESCE($1, nombre),
        especie          = COALESCE($2, especie),
        raza             = COALESCE($3, raza),
        color            = COALESCE($4, color),
        fecha_nacimiento = COALESCE($5, fecha_nacimiento),
        peso             = COALESCE($6, peso)
       WHERE codigo = $7`,
      [nombre ?? null, especie ?? null, raza ?? null, color ?? null, fechaNacimiento ?? null, peso ?? null, id],
    );

    await this.auditService.emit({
      action: 'ACTUALIZAR_MASCOTA',
      userId: id,
      userRole: null,
      entityType: 'MASCOTA',
      entityId: id,
      details: {
        nombre,
        especie,
        raza,
        color,
        fechaNacimiento,
        peso,
      },
    });

    return { mensaje: 'Mascota actualizada exitosamente' };
  }

  /**
   * Actualiza el peso actual de una mascota.
   * @param id - Código único de la mascota
   * @param body - Objeto con el nuevo peso: { peso }
   */
  async registrarPeso(id: string, body: any) {
    const { peso } = body;

    if (!peso) {
      throw new BadRequestException('El peso es obligatorio');
    }

    if (peso <= 0) {
      throw new BadRequestException('El peso debe ser mayor a 0');
    }

    const { rows: [mascota] } = await this.pool.query(
      `SELECT codigo FROM mascotas WHERE codigo = $1`,
      [id],
    );

    if (!mascota) {
      throw new NotFoundException('Mascota no encontrada');
    }

    await this.pool.query(
      `UPDATE mascotas SET peso = $1 WHERE codigo = $2`,
      [peso, id],
    );

    await this.auditService.emit({
      action: 'ACTUALIZAR_PESO_MASCOTA',
      userId: id,
      userRole: null,
      entityType: 'MASCOTA',
      entityId: id,
      details: { peso },
    });

    return { mensaje: 'Peso registrado exitosamente' };
  }

  /**
   * Cambia el estado de una mascota a 'hospitalizada'.
   * Solo se puede hacer si la mascota está activa.
   * @param id - Código único de la mascota
   */
  async hospitalizarMascota(id: string) {
    const { rows: [mascota] } = await this.pool.query(
      `SELECT codigo, estado FROM mascotas WHERE codigo = $1`,
      [id],
    );

    if (!mascota) {
      throw new NotFoundException('Mascota no encontrada');
    }

    if (mascota.estado !== 'activa') {
      throw new BadRequestException('Solo se puede hospitalizar una mascota con estado activa');
    }

    await this.pool.query(
      `UPDATE mascotas SET estado = 'hospitalizada' WHERE codigo = $1`,
      [id],
    );

    await this.auditService.emit({
      action: 'HOSPITALIZAR_MASCOTA',
      userId: id,
      userRole: null,
      entityType: 'MASCOTA',
      entityId: id,
      details: { estado: 'hospitalizada' },
    });

    return { mensaje: 'Mascota hospitalizada exitosamente' };
  }

  /**
   * Marca una mascota como fallecida.
   * No se puede aplicar si la mascota ya estaba registrada como fallecida.
   * @param id - Código único de la mascota
   */
  async registrarFallecimiento(id: string) {
    const { rows: [mascota] } = await this.pool.query(
      `SELECT codigo, estado FROM mascotas WHERE codigo = $1`,
      [id],
    );

    if (!mascota) {
      throw new NotFoundException('Mascota no encontrada');
    }

    if (mascota.estado === 'fallecida') {
      throw new BadRequestException('La mascota ya está registrada como fallecida');
    }

    await this.pool.query(
      `UPDATE mascotas SET estado = 'fallecida' WHERE codigo = $1`,
      [id],
    );

    await this.auditService.emit({
      action: 'FALLECIMIENTO_MASCOTA',
      userId: id,
      userRole: null,
      entityType: 'MASCOTA',
      entityId: id,
      details: { estado: 'fallecida' },
    });

    return { mensaje: 'Fallecimiento registrado exitosamente' };
  }
}