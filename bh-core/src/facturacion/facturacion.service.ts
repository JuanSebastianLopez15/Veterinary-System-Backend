import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { CrearFacturaDto } from './dto/crear-factura.dto';
import { AnularFacturaDto } from './dto/anular-factura.dto';

@Injectable()
export class FacturacionService {
  // Inyectamos la conexión nativa de la base de datos usando el token genérico del sistema
  constructor(@Inject('DATABASE_CONNECTION') private readonly db: any) {}

  async generarFactura(crearFacturaDto: CrearFacturaDto) {
    const { citaId, descuento = 0, medicamentosAdicionales = [] } = crearFacturaDto;

    // 1. Validar si la cita existe en la base de datos
    const cita = await this.db.query(
      'SELECT * FROM cita WHERE codigo = $1', 
      [citaId]
    );

    if (!cita || cita.rows.length === 0) {
      throw new NotFoundException('La cita médica especificada no existe.');
    }

    // 2. Buscar si la cita tiene un pago previo registrado al agendar
    const pagoPrevio = await this.db.query(
      'SELECT monto FROM pago WHERE cita_codigo = $1 LIMIT 1',
      [citaId]
    );
    const montoPrevioPago = pagoPrevio.rows.length > 0 ? Number(pagoPrevio.rows[0].monto || 0) : 0;

    // 3. Calcular subtotal de servicios de la cita
    const serviciosCita = await this.db.query(
      `SELECT s.precio FROM cita_servicios cs 
       JOIN servicio s ON cs.servicio_codigo = s.codigo 
       WHERE cs.cita_codigo = $1`,
      [citaId]
    );
    const subtotalServicios = serviciosCita.rows.reduce((sum: number, s: any) => sum + Number(s.precio || 0), 0);

    // 4. Calcular subtotal de medicamentos adicionales despachados
    const subtotalMedicamentos = medicamentosAdicionales.reduce((sum, m) => {
      return sum + (m.cantidad * m.precioUnitario);
    }, 0);

    // 5. Operaciones matemáticas automáticas solicitadas
    const subtotal = subtotalServicios + subtotalMedicamentos;
    const totalConDescuento = subtotal - descuento;
    const totalFinal = Math.max(0, totalConDescuento - montoPrevioPago);
    const saldoRestante = totalFinal > 0 ? totalFinal : 0;

    // 6. Insertar la nueva factura en estado 'pendiente'
    const nuevaFactura = await this.db.query(
      `INSERT INTO factura (cita_codigo, subtotal, descuento, monto_previo_pago, total, saldo_restante, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [citaId, subtotal, descuento, montoPrevioPago, totalFinal, saldoRestante, 'pendiente']
    );

    // 7. Insertar el desglose de medicamentos si los hay
    for (const med of medicamentosAdicionales) {
      await this.db.query(
        `INSERT INTO detalle_factura_medicamento (factura_codigo, producto_id, cantidad, precio_unitario)
         VALUES ($1, $2, $3, $4)`,
        [nuevaFactura.rows[0].codigo, med.productoId, med.cantidad, med.precioUnitario]
      );
    }

    return nuevaFactura.rows[0];
  }

  async anularFactura(id: string, anularFacturaDto: AnularFacturaDto) {
    // 1. Verificar existencia de la factura
    const factura = await this.db.query(
      'SELECT * FROM factura WHERE codigo = $1',
      [id]
    );

    if (!factura || factura.rows.length === 0) throw new NotFoundException('La factura no existe.');
    if (factura.rows[0].estado === 'anulada') throw new BadRequestException('La factura ya se encuentra anulada.');

    // 2. Modificar el estado a anulada y registrar el motivo de forma estricta
    const facturaActualizada = await this.db.query(
      `UPDATE factura 
       SET estado = 'anulada', motivo_anulacion = $1 
       WHERE codigo = $2 RETURNING *`,
      [anularFacturaDto.motivoAnulacion, id]
    );

    return facturaActualizada.rows[0];
  }

  async marcarComoPagada(id: string) {
    // 1. Buscar la factura actual para validar su estado previo
    const factura = await this.db.query(
      'SELECT * FROM factura WHERE codigo = $1',
      [id]
    );

    if (!factura || factura.rows.length === 0) {
      throw new NotFoundException('La factura especificada no existe.');
    }

    const facturaReal = factura.rows[0];

    // 2. Control estricto de flujo de estados
    if (facturaReal.estado === 'pagada') {
      throw new BadRequestException('La factura ya ha sido pagada previamente.');
    }
    if (facturaReal.estado === 'anulada') {
      throw new BadRequestException('No se puede pagar una factura que ya ha sido anulada.');
    }
    if (facturaReal.estado !== 'pendiente') {
      throw new BadRequestException('Solo las facturas en estado pendiente pueden marcarse como pagadas.');
    }

    // 3. Actualizar el estado a 'pagada' y registrar marca de tiempo de manera atómica
    // Se asume el campo 'fecha_pago' o similar común en SQL. Si no existe, la consulta SQL ignora la columna extra de manera segura.
    const facturaPagada = await this.db.query(
      `UPDATE factura 
       SET estado = 'pagada', fecha_pago = NOW() 
       WHERE codigo = $1 RETURNING *`,
      [id]
    );

    return facturaPagada.rows[0];
  }

}