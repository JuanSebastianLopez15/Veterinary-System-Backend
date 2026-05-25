import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService,
              private readonly auditService: AuditService,) {}

  /**
   * Registra un nuevo cliente en el sistema.
   * Crea el usuario base y el perfil de cliente en una sola transacción.
   * @param body - Datos del cliente: nombre, apellido, correo, contrasena, telefono, direccion, ciudad
   */
  async registrarCliente(body: any) {
    const { nombre, apellido, correo, contrasena, telefono, direccion, ciudad } = body;

    if (!nombre || !apellido || !correo || !contrasena || !telefono || !direccion || !ciudad) {
      throw new BadRequestException('Todos los campos son obligatorios');
    }

    if (!nombre.trim() || !apellido.trim()) {
      throw new BadRequestException('El nombre y apellido no pueden estar vacíos');
    }

    const correoRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!correoRegex.test(correo)) {
      throw new BadRequestException('El correo no tiene un formato válido');
    }

    const telefonoRegex = /^\d{7,15}$/;
    if (!telefonoRegex.test(telefono)) {
      throw new BadRequestException('El teléfono debe tener entre 7 y 15 dígitos numéricos');
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

      await this.auditService.emit({
        action: 'REGISTRO_CLIENTE',
        userId: usuario.codigo,
        userRole: 'CLIENTE',
        entityType: 'CLIENTE',
        entityId: cliente.codigo,
        details: {
          nombre,
          apellido,
          correo,
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

  /**
   * Devuelve la lista de todos los clientes registrados.
   * Los resultados vienen ordenados por nombre de forma alfabética.
   */
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

  /**
   * Busca clientes cuyo nombre contenga el texto recibido.
   * La búsqueda no distingue entre mayúsculas y minúsculas.
   * @param nombre - Texto a buscar en el nombre del cliente
   */
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

  /**
   * Devuelve los datos completos de un cliente, incluyendo sus mascotas.
   * @param id - Código único del cliente
   */
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

    await this.auditService.emit({
      action: 'CONSULTA_CLIENTE',
      userId: id,
      userRole: null,
      entityType: 'CLIENTE',
      entityId: id,
      details: { consulta: 'por_id' },
    });

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

  /**
   * Actualiza los datos de un cliente existente.
   * Solo se actualizan los campos que vienen en el body, los demás se quedan igual.
   * @param id - Código único del cliente
   * @param body - Campos a actualizar (todos opcionales)
   */
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

        await this.auditService.emit({
          action: 'ACTUALIZACION_CLIENTE',
          userId: id,
          userRole: null,
          entityType: 'CLIENTE',
          entityId: id,
          details: body,
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