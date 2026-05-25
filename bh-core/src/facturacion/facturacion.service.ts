import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { CrearFacturaDto } from './dto/crear-factura.dto';
import { AnularFacturaDto } from './dto/anular-factura.dto';
import { PdfGeneratorHelper } from '../reportesPDF/helpers/pdf-generator.helper';
import { REPORTES_COLORS } from '../reportesPDF/reportes-pdf.constants';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/enums/audit-action.enum';

@Injectable()
export class FacturacionService {
  constructor(
    @Inject('DATABASE_POOL') private readonly db: any,
    private readonly auditService: AuditService,
  ) {}

  async generarFactura(crearFacturaDto: CrearFacturaDto, actorId?: string, actorRole?: string) {
    const { citaId, descuento = 0, medicamentosAdicionales = [] } = crearFacturaDto;

    if (descuento < 0) {
      throw new BadRequestException('El valor del descuento no puede ser un número negativo.');
    }

    //Validar cita
    const citaQuery = await this.db.query(
      `SELECT codigo, cliente_codigo FROM cita WHERE codigo = $1`,
      [citaId]
    );
    if (!citaQuery || citaQuery.rows.length === 0) {
      throw new NotFoundException('La cita médica especificada no existe.');
    }
    const clienteCodigo = citaQuery.rows[0].cliente_codigo;

    //Verificar factura existente
    const facturaExistente = await this.db.query(
      'SELECT codigo FROM factura WHERE cita_codigo = $1',
      [citaId]
    );
    if (facturaExistente.rows.length > 0) {
      throw new BadRequestException('Ya existe una factura generada para esta cita.');
    }

    //Obtener prepago
    const pagoPrevio = await this.db.query(
      'SELECT monto FROM pago WHERE cita_codigo = $1 LIMIT 1',
      [citaId]
    );
    const montoPrepagado = pagoPrevio.rows.length > 0
      ? Math.max(0, Number(pagoPrevio.rows[0].monto || 0))
      : 0;

    //Calcular servicios
    const serviciosCita = await this.db.query(
      `SELECT s.precio FROM cita_servicios cs 
       JOIN servicio s ON cs.servicio_codigo = s.codigo 
       WHERE cs.cita_codigo = $1`,
      [citaId]
    );
    const totalServicios = serviciosCita.rows.reduce(
      (sum: number, s: any) => sum + Math.max(0, Number(s.precio || 0)),
      0
    );

    // obtener precio base
    let totalMedicamentos = 0;
    for (const med of medicamentosAdicionales) {
      if (med.cantidad <= 0) {
        throw new BadRequestException('La cantidad de medicamentos debe ser mayor a cero.');
      }
      const prodBase = await this.db.query(
        'SELECT precio FROM producto WHERE codigo = $1',
        [med.productoId]
      );
      if (!prodBase || prodBase.rows.length === 0) {
        throw new NotFoundException(`El producto con id ${med.productoId} no existe.`);
      }
      totalMedicamentos += Number(prodBase.rows[0].precio) * med.cantidad;
    }

    //Calcular totales de la factura
    const subtotalCalculado = totalServicios + totalMedicamentos;
    if (descuento > subtotalCalculado) {
      throw new BadRequestException(`El descuento ($${descuento}) no puede superar al subtotal.`);
    }
    const totalConDescuento = subtotalCalculado - descuento;
    const saldoPendiente = Math.max(0, totalConDescuento - montoPrepagado);

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      //Insertar la factura
      const nuevaFactura = await client.query(
        `INSERT INTO factura (cita_codigo, cliente_codigo, total, descuento, prepagado, saldo_pendiente)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [citaId, clienteCodigo, totalConDescuento, descuento, montoPrepagado, saldoPendiente]
      );

      for (const med of medicamentosAdicionales) {
    
        const productoLock = await client.query(
          'SELECT stock FROM producto WHERE codigo = $1 FOR UPDATE',
          [med.productoId]
        );
        
        const stockActual = productoLock.rows[0]?.stock ?? 0;

        if (stockActual < med.cantidad) {
          throw new BadRequestException(
            `Stock insuficiente en el momento exacto de facturar para el producto ${med.productoId}. Disponible: ${stockActual}.`
          );
        }

        await client.query(
          `UPDATE producto SET stock = stock - $1 WHERE codigo = $2`,
          [med.cantidad, med.productoId]
        );
      }

      await client.query('COMMIT');
      const factura = nuevaFactura.rows[0];

      this.auditService.emit({
        action: AuditAction.CREACION_FACTURA,
        userId: actorId ?? 'system',
        userRole: actorRole ?? 'recepcionista',
        entityType: 'Invoice',
        entityId: factura.codigo,
        details: { citaId, total: factura.total, descuento, saldoPendiente: factura.saldo_pendiente },
      }).catch(() => {});

      return factura;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async anularFactura(id: string, anularFacturaDto: AnularFacturaDto, actorId?: string, actorRole?: string) {
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

    const facturaActualizada = await this.db.query(
      `UPDATE factura
       SET estado = 'anulada', motivo_anulado = $1
       WHERE codigo = $2
       RETURNING *`,
      [anularFacturaDto.motivoAnulacion, id]
    );

    const anulada = facturaActualizada.rows[0];

    this.auditService.emit({
      action: AuditAction.ANULACION_FACTURA,
      userId: actorId ?? 'system',
      userRole: actorRole ?? 'recepcionista',
      entityType: 'Invoice',
      entityId: id,
      details: { motivo: anularFacturaDto.motivoAnulacion },
    }).catch(() => {});

    return anulada;
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
      `SELECT f.*, u.nombre AS cliente_nombre, u.apellido AS cliente_apellido, m.nombre AS mascota_nombre
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