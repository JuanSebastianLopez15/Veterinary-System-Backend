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

  async registrarMascota(body: any) {
    const { clienteCodigo, nombre, especie, raza, color, fechaNacimiento, peso } = body;

    if (!clienteCodigo || !nombre || !especie || !raza || !color || !fechaNacimiento || !peso) {
      throw new BadRequestException('Todos los campos son obligatorios');
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

  async actualizarMascota(id: string, body: any) {
    const { nombre, especie, raza, color, fechaNacimiento, peso } = body;

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

  async registrarPeso(id: string, body: any) {
    const { peso } = body;

    if (!peso) {
      throw new BadRequestException('El peso es obligatorio');
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