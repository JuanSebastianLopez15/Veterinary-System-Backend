import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { CrearFacturaDto } from './dto/crear-factura.dto';
import { AnularFacturaDto } from './dto/anular-factura.dto';

@Injectable()
export class FacturacionService {
  constructor(@Inject('DATABASE_POOL') private readonly db: any) {}

  async generarFactura(crearFacturaDto: CrearFacturaDto) {
    const { citaId, descuento = 0, medicamentosAdicionales = [] } = crearFacturaDto;

    if (descuento < 0) {
      throw new BadRequestException('El valor del descuento no puede ser un número negativo.');
    }

    // 1. Validar que la cita existe y obtener cliente_codigo
    const citaQuery = await this.db.query(
      `SELECT codigo, cliente_codigo FROM cita WHERE codigo = $1`,
      [citaId]
    );
    if (!citaQuery || citaQuery.rows.length === 0) {
      throw new NotFoundException('La cita médica especificada no existe.');
    }
    const clienteCodigo = citaQuery.rows[0].cliente_codigo;

    // 2. Verificar que no exista ya una factura para esta cita
    const facturaExistente = await this.db.query(
      'SELECT codigo FROM factura WHERE cita_codigo = $1',
      [citaId]
    );
    if (facturaExistente.rows.length > 0) {
      throw new BadRequestException('Ya existe una factura generada para esta cita.');
    }

    // 3. Obtener prepago (lo que el cliente pagó al agendar)
    const pagoPrevio = await this.db.query(
      'SELECT monto FROM pago WHERE cita_codigo = $1 LIMIT 1',
      [citaId]
    );
    const montoPrepagado =
      pagoPrevio.rows.length > 0
        ? Math.max(0, Number(pagoPrevio.rows[0].monto || 0))
        : 0;

    // 4. Calcular total de servicios de la cita
    const serviciosCita = await this.db.query(
      `SELECT s.precio
       FROM cita_servicios cs
       JOIN servicio s ON cs.servicio_codigo = s.codigo
       WHERE cs.cita_codigo = $1`,
      [citaId]
    );
    const totalServicios = serviciosCita.rows.reduce(
      (sum: number, s: any) => sum + Math.max(0, Number(s.precio || 0)),
      0
    );

    // 5. Calcular total de medicamentos adicionales despachados
    //    El precio se toma desde la DB (producto.precio), no del DTO,
    //    para evitar manipulación de precios desde el cliente.
    let totalMedicamentos = 0;
    for (const med of medicamentosAdicionales) {
      if (med.cantidad <= 0) {
        throw new BadRequestException('La cantidad de medicamentos debe ser mayor a cero.');
      }

      const productoQuery = await this.db.query(
        'SELECT codigo, precio, stock FROM producto WHERE codigo = $1',
        [med.productoId]
      );
      if (!productoQuery || productoQuery.rows.length === 0) {
        throw new NotFoundException(`El producto con id ${med.productoId} no existe en el inventario.`);
      }

      const producto = productoQuery.rows[0];
      if (producto.stock < med.cantidad) {
        throw new BadRequestException(
          `Stock insuficiente para el producto ${med.productoId}. Disponible: ${producto.stock}, solicitado: ${med.cantidad}.`
        );
      }

      totalMedicamentos += Number(producto.precio) * med.cantidad;
    }

    // 6. Calcular totales
    const subtotalCalculado = totalServicios + totalMedicamentos;

    if (descuento > subtotalCalculado) {
      throw new BadRequestException(
        `El descuento ($${descuento}) no puede ser mayor que el subtotal ($${subtotalCalculado}).`
      );
    }

    const totalConDescuento = subtotalCalculado - descuento;
    const saldoPendiente = Math.max(0, totalConDescuento - montoPrepagado);

    // 7. Insertar la factura
    const nuevaFactura = await this.db.query(
      `INSERT INTO factura (cita_codigo, cliente_codigo, total, descuento, prepagado, saldo_pendiente)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [citaId, clienteCodigo, totalConDescuento, descuento, montoPrepagado, saldoPendiente]
    );
    const facturaCodigo = nuevaFactura.rows[0].codigo;

    // 8. Descontar stock de cada medicamento adicional
    for (const med of medicamentosAdicionales) {
      await this.db.query(
        `UPDATE producto SET stock = stock - $1 WHERE codigo = $2`,
        [med.cantidad, med.productoId]
      );
    }

    return nuevaFactura.rows[0];
  }

  async anularFactura(id: string, anularFacturaDto: AnularFacturaDto) {
    const factura = await this.db.query(
      'SELECT * FROM factura WHERE codigo = $1',
      [id]
    );

    if (!factura || factura.rows.length === 0) {
      throw new NotFoundException('La factura no existe.');
    }
    if (factura.rows[0].estado === 'anulada') {
      throw new BadRequestException('La factura ya se encuentra anulada.');
    }

    // El enunciado aclara: la anulación NO devuelve el inventario
    const facturaActualizada = await this.db.query(
      `UPDATE factura
       SET estado = 'anulada', motivo_anulado = $1
       WHERE codigo = $2
       RETURNING *`,
      [anularFacturaDto.motivoAnulacion, id]
    );

    return facturaActualizada.rows[0];
  }

  async marcarComoPagada(id: string) {
    const factura = await this.db.query(
      'SELECT * FROM factura WHERE codigo = $1',
      [id]
    );

    if (!factura || factura.rows.length === 0) {
      throw new NotFoundException('La factura especificada no existe.');
    }

    const facturaReal = factura.rows[0];

    if (facturaReal.estado === 'pagada') {
      throw new BadRequestException('La factura ya ha sido pagada previamente.');
    }
    if (facturaReal.estado === 'anulada') {
      throw new BadRequestException('No se puede pagar una factura que ya ha sido anulada.');
    }
    if (facturaReal.estado !== 'pendiente') {
      throw new BadRequestException('Solo las facturas en estado pendiente pueden marcarse como pagadas.');
    }

    const facturaPagada = await this.db.query(
      `UPDATE factura
       SET estado = 'pagada', saldo_pendiente = 0
       WHERE codigo = $1
       RETURNING *`,
      [id]
    );

    return facturaPagada.rows[0];
  }

  async consultarFacturas(estado?: string) {
    let query = 'SELECT * FROM factura';
    const params: any[] = [];

    if (estado) {
      const estadoLimpio = estado.toLowerCase().trim();
      if (['pendiente', 'pagada', 'anulada'].includes(estadoLimpio)) {
        query += ' WHERE estado = $1';
        params.push(estadoLimpio);
      }
    }

    query += ' ORDER BY fecha DESC';

    const resultado = await this.db.query(query, params);
    return resultado.rows;
  }

  async generarFacturaPdf(facturaId: string, clienteId: string): Promise<Buffer> {
    const facturaQuery = await this.db.query(
      `SELECT f.*,
              u.nombre AS cliente_nombre,
              ms.nombre AS mascota_nombre
       FROM factura f
       JOIN cliente cl ON f.cliente_codigo = cl.codigo
       JOIN usuario u ON cl.usuario_codigo = u.codigo
       JOIN cita c ON f.cita_codigo = c.codigo
       JOIN mascotas ms ON c.mascota_codigo = ms.codigo
       WHERE f.codigo = $1`,
      [facturaId]
    );

    if (!facturaQuery || facturaQuery.rows.length === 0) {
      throw new NotFoundException('La factura especificada no existe.');
    }

    const factura = facturaQuery.rows[0];

    if (factura.cliente_codigo !== clienteId) {
      throw new BadRequestException('Acceso denegado. Esta factura pertenece a otro cliente.');
    }

    const encabezadoPdf = `%PDF-1.4\n%B&H_Veterinary_Invoice_Colors:[#48a378,#34795a,#c2e9ce]\n`;
    const cuerpoDatos = `Factura:${factura.codigo}\nCliente:${factura.cliente_nombre}\nMascota:${factura.mascota_nombre}\n`;
    const financieros = `Descuento:${factura.descuento}\nPrepagado:${factura.prepagado}\nTotal:${factura.total}\nSaldoPendiente:${factura.saldo_pendiente}\nEstado:${factura.estado}\n`;

    return Buffer.from(`${encabezadoPdf}${cuerpoDatos}${financieros}%%EOF`, 'utf-8');
  }
}