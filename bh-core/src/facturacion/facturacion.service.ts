import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { CrearFacturaDto } from './dto/crear-factura.dto';
import { AnularFacturaDto } from './dto/anular-factura.dto';
import { PdfGeneratorHelper } from '../reportesPDF/helpers/pdf-generator.helper';
import { REPORTES_COLORS } from '../reportesPDF/reportes-pdf.constants';

@Injectable()
export class FacturacionService {
  constructor(@Inject('DATABASE_POOL') private readonly db: any) {}

  async generarFactura(crearFacturaDto: CrearFacturaDto) {
    const { citaId, descuento = 0, medicamentosAdicionales = [] } = crearFacturaDto;

    if (descuento < 0) {
      throw new BadRequestException('El valor del descuento no puede ser un número negativo.');
    }

    //Validar la cita y obtener el cliente_codigo asociado a ella
    const citaQuery = await this.db.query(
      `SELECT c.*, m.usuario_codigo AS cliente_codigo 
       FROM cita c
       JOIN mascota m ON c.mascota_codigo = m.codigo
       WHERE c.codigo = $1`, 
      [citaId]
    );
    
    if (!citaQuery || citaQuery.rows.length === 0) {
      throw new NotFoundException('La cita médica especificada no existe.');
    }
    const cita = citaQuery.rows[0];
    const clienteCodigo = cita.cliente_codigo;

    //Buscar pago previo 
    const pagoPrevio = await this.db.query(
      'SELECT monto FROM pago WHERE cita_codigo = $1 LIMIT 1',
      [citaId]
    );
    const montoPrepagado = pagoPrevio.rows.length > 0 ? Math.max(0, Number(pagoPrevio.rows[0].monto || 0)) : 0;

    //Calcular costos de servicios
    const serviciosCita = await this.db.query(
      `SELECT s.precio FROM cita_servicios cs 
       JOIN servicio s ON cs.servicio_codigo = s.codigo 
       WHERE cs.cita_codigo = $1`,
      [citaId]
    );
    const totalServicios = serviciosCita.rows.reduce((sum: number, s: any) => sum + Math.max(0, Number(s.precio || 0)), 0);

    //Calcular costos de medicamentos adicionales
    let totalMedicamentos = 0;
    for (const med of medicamentosAdicionales) {
      if (med.cantidad <= 0 || med.precioUnitario < 0) {
        throw new BadRequestException('Cantidades o precios de medicamentos inválidos.');
      }
      totalMedicamentos += (med.cantidad * med.precioUnitario);
    }

    const subtotalCalculado = totalServicios + totalMedicamentos;

    if (descuento > subtotalCalculado) {
      throw new BadRequestException(`El descuento ($${descuento}) no puede ser mayor que el subtotal ($${subtotalCalculado}).`);
    }

    const totalConDescuento = subtotalCalculado - descuento;
    const totalFinal = Math.max(0, totalConDescuento - montoPrepagado);
    const saldoPendiente = totalFinal;

    // Inserción SQL adaptada
    const nuevaFactura = await this.db.query(
      `INSERT INTO factura (cita_codigo, cliente_codigo, total, descuento, prepagado, saldo_pendiente)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [citaId, clienteCodigo, totalFinal, descuento, montoPrepagado, saldoPendiente]
    );

    //Insertar medicamentos
    for (const med of medicamentosAdicionales) {
      await this.db.query(
        `INSERT INTO detalle_factura_medicamento (factura_codigo, producto_codigo, cantidad, precio_unitario)
         VALUES ($1, $2, $3, $4)`,
        [nuevaFactura.rows[0].codigo, med.productoId, med.cantidad, med.precioUnitario]
      );
    }

    return nuevaFactura.rows[0];
  }

  async anularFactura(id: string, anularFacturaDto: AnularFacturaDto) {
    // Verificar existencia de la factura
    const factura = await this.db.query(
      'SELECT * FROM factura WHERE codigo = $1',
      [id]
    );

    if (!factura || factura.rows.length === 0) throw new NotFoundException('La factura no existe.');
    if (factura.rows[0].estado === 'anulada') throw new BadRequestException('La factura ya se encuentra anulada.');

    const facturaActualizada = await this.db.query(
      `UPDATE factura 
       SET estado = 'anulada', motivo_allowed = $1 
       WHERE codigo = $2 RETURNING *`,
      [anularFacturaDto.motivoAnulacion, id]
    );

    return facturaActualizada.rows[0];
  }

  async marcarComoPagada(id: string) {
    // Buscar la factura actual para validar su estado previo
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

    // Actualizar el estado
    const facturaPagada = await this.db.query(
      `UPDATE factura 
       SET estado = 'pagada', saldo_pendiente = 0 
       WHERE codigo = $1 RETURNING *`,
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

    query += ' ORDER BY codigo DESC';

    const resultado = await this.db.query(query, params);
    return resultado.rows;
  }

  async generarFacturaPdf(facturaId: string, clienteId: string): Promise<Buffer> {
    const facturaQuery = await this.db.query(
      `SELECT f.*, u.nombre AS cliente_nombre, u.apellido AS cliente_apellido, m.nombre AS mascota_nombre
       FROM factura f
       JOIN cliente cl ON f.cliente_codigo = cl.codigo
       JOIN usuario u ON cl.usuario_codigo = u.codigo
       JOIN cita c ON f.cita_codigo = c.codigo
       JOIN mascotas m ON c.mascota_codigo = m.codigo
       WHERE f.codigo = $1`,
      [facturaId]
    );

    if (!facturaQuery || facturaQuery.rows.length === 0) {
      throw new NotFoundException('La factura especificada no existe.');
    }

    const factura = facturaQuery.rows[0];

    // Validación de seguridad
    if (factura.cliente_codigo !== clienteId) {
      throw new BadRequestException('Acceso denegado. Esta factura pertenece a otro cliente.');
    }

    const doc = PdfGeneratorHelper.createBaseDocument(`Factura N° ${factura.codigo.substring(0,8).toUpperCase()}`);
    
    doc.fontSize(10)
       .font('Helvetica')
       .text(`Cliente: ${factura.cliente_nombre} ${factura.cliente_apellido || ''}`)
       .text(`Mascota: ${factura.mascota_nombre}`)
       .moveDown(1);
       
    const prepagado = Number(factura.prepagado) || 0;
    const descuento = Number(factura.descuento) || 0;
    const total = Number(factura.total) || 0;
    const saldoPendiente = Number(factura.saldo_pendiente) || 0;
       
    doc.text(`Subtotal / Total Bruto: $${(total + descuento + prepagado).toFixed(2)}`)
       .text(`Descuento: $${descuento.toFixed(2)}`)
       .text(`Prepagado al agendar: $${prepagado.toFixed(2)}`)
       .font('Helvetica-Bold')
       .fillColor(REPORTES_COLORS.VERDE_OSCURO)
       .text(`Total Facturado: $${total.toFixed(2)}`)
       .text(`Saldo Pendiente: $${saldoPendiente.toFixed(2)}`)
       .font('Helvetica')
       .fillColor(REPORTES_COLORS.TEXTO_NEGRO)
       .text(`Estado: ${factura.estado.toUpperCase()}`)
       .moveDown(1);
       
    PdfGeneratorHelper.finalizeAndPaging(doc);

    return new Promise<Buffer>((resolve, reject) => {
      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);
    });
  }
}