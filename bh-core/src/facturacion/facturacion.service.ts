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
      const prodBase = await this.db.query('SELECT precio FROM producto WHERE codigo = $1', [med.productoId]);
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
      return nuevaFactura.rows[0];

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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

    const serviciosQuery = await this.db.query(
      `SELECT s.nombre, s.precio
       FROM cita_servicios cs
       JOIN servicio s ON cs.servicio_codigo = s.codigo
       WHERE cs.cita_codigo = $1`,
      [factura.cita_codigo]
    );

    // PDF real con PDFKit corregido para flujos de memoria asíncronos seguros
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50 });
    const chunks: any[] = [];

    await new Promise<void>((resolve, reject) => {
      doc.on('data', (chunk: any) => chunks.push(chunk));
      doc.on('end', resolve);
      doc.on('error', reject);

      // Encabezado corporativo
      doc
        .fontSize(20)
        .fillColor('#34795a')
        .font('Helvetica-Bold')
        .text('Breaze & Harold Veterinary System', { align: 'center' });
      doc
        .fontSize(12)
        .fillColor('#555555')
        .font('Helvetica')
        .text('Factura de Atención Veterinaria', { align: 'center' });
      doc.moveDown();

      // Datos generales
      doc
        .fontSize(10)
        .fillColor('#000000')
        .text(`Factura N°: ${factura.codigo}`)
        .text(`Fecha: ${new Date(factura.fecha).toLocaleDateString('es-CO')}`)
        .text(`Estado: ${factura.estado.toUpperCase()}`)
        .text(`Cliente: ${factura.cliente_nombre}`)
        .text(`Mascota: ${factura.mascota_nombre}`);
      doc.moveDown();

      // Lista de Servicios
      doc.fontSize(12).fillColor('#34795a').font('Helvetica-Bold').text('Servicios prestados', { underline: true });
      doc.fontSize(10).fillColor('#000000').font('Helvetica');
      doc.moveDown(0.3);
      
      for (const s of serviciosQuery.rows) {
        const precio = Number(s.precio);
        doc.text(`  • ${s.nombre}: $${precio.toLocaleString('es-CO')}`);
      }
      doc.moveDown();

      // Resumen financiero consolidado
      doc.fontSize(12).fillColor('#34795a').font('Helvetica-Bold').text('Resumen Económico', { underline: true });
      doc.fontSize(10).fillColor('#000000').font('Helvetica');
      doc.moveDown(0.3);

      doc
        .text(`Subtotal:           $${(Number(factura.total) + Number(factura.descuento)).toLocaleString('es-CO')}`)
        .text(`Descuento:        -$${Number(factura.descuento).toLocaleString('es-CO')}`)
        .text(`Prepagado:        -$${Number(factura.prepagado).toLocaleString('es-CO')}`)
        .font('Helvetica-Bold')
        .text(`Saldo pendiente:   $${Number(factura.saldo_pendiente).toLocaleString('es-CO')}`)
        .text(`Total factura:      $${Number(factura.total).toLocaleString('es-CO')}`);

      doc.end();
    });

    return Buffer.concat(chunks);
  }
}