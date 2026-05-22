import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';import { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.provider';

@Injectable()
export class MascotasService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

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

    return { mensaje: 'Mascota actualizada exitosamente' };
  }
}