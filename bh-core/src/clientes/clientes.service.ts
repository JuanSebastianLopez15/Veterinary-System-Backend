import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.provider';

@Injectable()
export class ClientesService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async registrarCliente(body: any) {
    const { nombre, apellido, correo, contrasena, telefono, direccion, ciudad } = body;

    if (!nombre || !apellido || !correo || !contrasena || !telefono || !direccion || !ciudad) {
      throw new BadRequestException('Todos los campos son obligatorios');
    }

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const existe = await client.query(
        `SELECT 1 FROM usuario WHERE correo = $1 LIMIT 1`,
        [correo],
      );

      if (existe.rowCount > 0) {
        throw new ConflictException('Ya existe un usuario con ese correo');
      }

      const { rows: [usuario] } = await client.query(
        `INSERT INTO usuario (nombre, apellido, correo, contrasena, rol, telefono, estado)
         VALUES ($1, $2, $3, $4, 'CLIENTE', $5, 'activo')
         RETURNING codigo`,
        [nombre, apellido, correo, contrasena, telefono],
      );

      const { rows: [cliente] } = await client.query(
        `INSERT INTO cliente (usuario_codigo, direccion, ciudad)
         VALUES ($1, $2, $3)
         RETURNING codigo`,
        [usuario.codigo, direccion, ciudad],
      );

      await client.query('COMMIT');

      return { codigo: cliente.codigo, usuarioCodigo: usuario.codigo, nombre, apellido, correo, telefono, direccion, ciudad };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async consultarClientes() {
    const { rows } = await this.pool.query(
      `SELECT c.codigo, u.nombre, u.apellido, u.telefono
       FROM cliente c
       JOIN usuario u ON c.usuario_codigo = u.codigo
       ORDER BY u.nombre ASC`,
    );

    return rows;
  }

  async consultarClientesPorNombre(nombre: string) {
    if (!nombre) {
      throw new BadRequestException('El nombre es obligatorio');
    }

    const { rows } = await this.pool.query(
      `SELECT c.codigo, u.nombre, u.apellido, u.telefono
       FROM cliente c
       JOIN usuario u ON c.usuario_codigo = u.codigo
       WHERE u.nombre ILIKE '%' || $1 || '%'
       ORDER BY u.nombre ASC`,
      [nombre],
    );

    return rows;
  }

  async consultarClientePorId(id: string) {
    const { rows: [cliente] } = await this.pool.query(
      `SELECT c.codigo, u.nombre, u.apellido, u.correo, u.telefono, c.direccion, c.ciudad
       FROM cliente c
       JOIN usuario u ON c.usuario_codigo = u.codigo
       WHERE c.codigo = $1`,
      [id],
    );

    if (!cliente) {
      throw new NotFoundException('Cliente no encontrado');
    }

    const { rows: mascotas } = await this.pool.query(
      `SELECT codigo, nombre, estado
       FROM mascotas
       WHERE cliente_codigo = $1`,
      [id],
    );

    return { ...cliente, mascotas };
  }

  async actualizarCliente(id: string, body: any) {
    const { nombre, apellido, correo, telefono, direccion, ciudad } = body;

    const { rows: [cliente] } = await this.pool.query(
      `SELECT c.codigo, c.usuario_codigo FROM cliente c WHERE c.codigo = $1`,
      [id],
    );

    if (!cliente) {
      throw new NotFoundException('Cliente no encontrado');
    }

    if (nombre || apellido || correo || telefono) {
      await this.pool.query(
        `UPDATE usuario SET
          nombre   = COALESCE($1, nombre),
          apellido = COALESCE($2, apellido),
          correo   = COALESCE($3, correo),
          telefono = COALESCE($4, telefono)
         WHERE codigo = $5`,
        [nombre ?? null, apellido ?? null, correo ?? null, telefono ?? null, cliente.usuario_codigo],
      );
    }

    if (direccion || ciudad) {
      await this.pool.query(
        `UPDATE cliente SET
          direccion = COALESCE($1, direccion),
          ciudad    = COALESCE($2, ciudad)
         WHERE codigo = $3`,
        [direccion ?? null, ciudad ?? null, id],
      );
    }

    return { mensaje: 'Cliente actualizado exitosamente' };
  }
}