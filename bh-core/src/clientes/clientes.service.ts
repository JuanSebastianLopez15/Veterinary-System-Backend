import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  async registrarCliente(body: any) {
    const { nombre, apellido, correo, contrasena, telefono, direccion, ciudad } = body;

    if (!nombre || !apellido || !correo || !contrasena || !telefono || !direccion || !ciudad) {
      throw new BadRequestException('Todos los campos son obligatorios');
    }

    return await this.prisma.$transaction(async (tx) => {
      const existe = await tx.usuario.findFirst({
        where: { correo: correo.toLowerCase() },
      });

      if (existe) {
        throw new ConflictException('Ya existe un usuario con ese correo');
      }

      const usuario = await tx.usuario.create({
        data: {
          nombre,
          apellido,
          correo: correo.toLowerCase(),
          contrasena,
          rol: 'CLIENTE',
          telefono,
          estado: 'activo',
        },
      });

      const cliente = await tx.cliente.create({
        data: {
          usuario_codigo: usuario.codigo,
          direccion,
          ciudad,
        },
      });

      return {
        codigo: cliente.codigo,
        usuarioCodigo: usuario.codigo,
        nombre,
        apellido,
        correo,
        telefono,
        direccion,
        ciudad,
      };
    });
  }

  async consultarClientes() {
    const clientes = await this.prisma.cliente.findMany({
      include: {
        usuario: {
          select: { nombre: true, apellido: true, telefono: true },
        },
      },
      orderBy: {
        usuario: { nombre: 'asc' },
      },
    });

    return clientes.map((c) => ({
      codigo: c.codigo,
      nombre: c.usuario?.nombre,
      apellido: c.usuario?.apellido,
      telefono: c.usuario?.telefono,
    }));
  }

  async consultarClientesPorNombre(nombre: string) {
    if (!nombre) {
      throw new BadRequestException('El nombre es obligatorio');
    }

    const clientes = await this.prisma.cliente.findMany({
      where: {
        usuario: {
          nombre: { contains: nombre, mode: 'insensitive' },
        },
      },
      include: {
        usuario: {
          select: { nombre: true, apellido: true, telefono: true },
        },
      },
      orderBy: {
        usuario: { nombre: 'asc' },
      },
    });

    return clientes.map((c) => ({
      codigo: c.codigo,
      nombre: c.usuario?.nombre,
      apellido: c.usuario?.apellido,
      telefono: c.usuario?.telefono,
    }));
  }

  async consultarClientePorId(id: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { codigo: id },
      include: {
        usuario: {
          select: { nombre: true, apellido: true, correo: true, telefono: true },
        },
        mascotas: {
          select: { codigo: true, nombre: true, estado: true },
        },
      },
    });

    if (!cliente) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return {
      codigo: cliente.codigo,
      nombre: cliente.usuario?.nombre,
      apellido: cliente.usuario?.apellido,
      correo: cliente.usuario?.correo,
      telefono: cliente.usuario?.telefono,
      direccion: cliente.direccion,
      ciudad: cliente.ciudad,
      mascotas: cliente.mascotas,
    };
  }

  async actualizarCliente(id: string, body: any) {
    const { nombre, apellido, correo, telefono, direccion, ciudad } = body;

    const cliente = await this.prisma.cliente.findUnique({
      where: { codigo: id },
    });

    if (!cliente) {
      throw new NotFoundException('Cliente no encontrado');
    }

    await this.prisma.$transaction(async (tx) => {
      if (nombre || apellido || correo || telefono) {
        await tx.usuario.update({
          where: { codigo: cliente.usuario_codigo },
          data: {
            nombre: nombre ?? undefined,
            apellido: apellido ?? undefined,
            correo: correo ?? undefined,
            telefono: telefono ?? undefined,
          },
        });
      }

      if (direccion || ciudad) {
        await tx.cliente.update({
          where: { codigo: id },
          data: {
            direccion: direccion ?? undefined,
            ciudad: ciudad ?? undefined,
          },
        });
      }
    });

    return { mensaje: 'Cliente actualizado exitosamente' };
  }
}