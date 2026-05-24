import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { CrearFacturaDto } from './dto/crear-factura.dto';
import { AnularFacturaDto } from './dto/anular-factura.dto';

@Injectable()
export class FacturacionService {
  constructor(@Inject('DATABASE_POOL') private readonly db: any) {}

  async generarFactura(crearFacturaDto: CrearFacturaDto) {
    const { citaId, descuento = 0, medicamentosAdicionales = [] } = crearFacturaDto;

    //Validación inicial del descuento
    if (descuento < 0) {
      throw new BadRequestException('El valor del descuento no puede ser un número negativo.');
    }

    //Validar si la cita existe
    const cita = await this.db.query('SELECT * FROM cita WHERE codigo = $1', [citaId]);
    if (!cita || cita.rows.length === 0) {
      throw new NotFoundException('La cita médica especificada no existe.');
    }

    //Buscar pago previo registrado
    const pagoPrevio = await this.db.query(
      'SELECT monto FROM pago WHERE cita_codigo = $1 LIMIT 1',
      [citaId]
    );
    
    // Forzamos que el pago previo sea un número válido y nunca menor a cero
    const montoPrevioPago = pagoPrevio.rows.length > 0 ? Math.max(0, Number(pagoPrevio.rows[0].monto || 0)) : 0;

    //Calcular subtotal de servicios
    const serviciosCita = await this.db.query(
      `SELECT s.precio FROM cita_servicios cs 
       JOIN servicio s ON cs.servicio_codigo = s.codigo 
       WHERE cs.cita_codigo = $1`,
      [citaId]
    );
    const subtotalServicios = serviciosCita.rows.reduce((sum: number, s: any) => {
      const precioServicio = Number(s.precio || 0);
      return sum + (precioServicio > 0 ? precioServicio : 0); // Evita precios negativos en la BD
    }, 0);

    //Calcular subtotal de medicamentos adicionales con validación
    let subtotalMedicamentos = 0;
    for (const med of medicamentosAdicionales) {
      //Cantidades y precios consistentes
      if (med.cantidad <= 0) {
        throw new BadRequestException(`La cantidad del producto ${med.productoId} debe ser mayor a cero.`);
      }
      if (med.precioUnitario < 0) {
        throw new BadRequestException(`El precio unitario del producto ${med.productoId} no puede ser negativo.`);
      }
      subtotalMedicamentos += (med.cantidad * med.precioUnitario);
    }

    const subtotal = subtotalServicios + subtotalMedicamentos;

    //El descuento no puede superar el 100% del subtotal
    if (descuento > subtotal) {
      throw new BadRequestException(`El descuento ($${descuento}) no puede ser mayor que el subtotal acumulado ($${subtotal}).`);
    }

    // Cálculo del total intermedio tras aplicar el descuento
    const totalConDescuento = subtotal - descuento;

    // El total final es lo que queda tras restar el pago previo. 
    // garantizar que no sea negativo si el cliente pagó de más al agendar.
    const totalFinal = Math.max(0, totalConDescuento - montoPrevioPago);
    
    // El saldo restante sigue la misma regla de consistencia
    const saldoRestante = totalFinal;

    //Insertar la nueva factura 
    const nuevaFactura = await this.db.query(
      `INSERT INTO factura (cita_codigo, subtotal, descuento, monto_previo_pago, total, saldo_restante, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [citaId, subtotal, descuento, montoPrevioPago, totalFinal, saldoRestante, 'pendiente']
    );

    // Insertar medicamentos
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
    // Verificar existencia de la factura
    const factura = await this.db.query(
      'SELECT * FROM factura WHERE codigo = $1',
      [id]
    );

    if (!factura || factura.rows.length === 0) throw new NotFoundException('La factura no existe.');
    if (factura.rows[0].estado === 'anulada') throw new BadRequestException('La factura ya se encuentra anulada.');

    // Modificar el estado a anulada y registrar el motivo 
    const facturaActualizada = await this.db.query(
      `UPDATE factura 
       SET estado = 'anulada', motivo_anulacion = $1 
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

    // Control estricto de flujo de estados
    if (facturaReal.estado === 'pagada') {
      throw new BadRequestException('La factura ya ha sido pagada previamente.');
    }
    if (facturaReal.estado === 'anulada') {
      throw new BadRequestException('No se puede pagar una factura que ya ha sido anulada.');
    }
    if (facturaReal.estado !== 'pendiente') {
      throw new BadRequestException('Solo las facturas en estado pendiente pueden marcarse como pagadas.');
    }

    //Actualizar el estado a 'pagada' y registrar marca de tiempo 
    const facturaPagada = await this.db.query(
      `UPDATE factura 
       SET estado = 'pagada', fecha_pago = NOW() 
       WHERE codigo = $1 RETURNING *`,
      [id]
    );

    return facturaPagada.rows[0];
  }

  async consultarFacturas(estado?: string) {
    let query = 'SELECT * FROM factura';
    const params: any[] = [];

    // Si la recepcionista seleccionó un filtro válido, se aplica a la consulta SQL
    if (estado) {
      const estadoLimpio = estado.toLowerCase().trim();
      if (['pendiente', 'pagada', 'anulada'].includes(estadoLimpio)) {
        query += ' WHERE estado = $1';
        params.push(estadoLimpio);
      }
    }

    // Ordena por fecha de creación o código para que la UI lo muestre organizado
    query += ' ORDER BY codigo DESC';

    const resultado = await this.db.query(query, params);
    return resultado.rows;
  }

  async generarFacturaPdf(facturaId: string, clienteId: string): Promise<Buffer> {
    // Obtener la factura junto con los datos de la cita y el usuario
    // validar la pertenencia del registro al cliente logueado
    const facturaQuery = await this.db.query(
      `SELECT f.*, c.mascota_codigo, m.nombre AS mascota_nombre, u.codigo AS cliente_codigo, u.nombre AS cliente_nombre
       FROM factura f
       JOIN cita c ON f.cita_codigo = c.codigo
       JOIN mascota m ON c.mascota_codigo = m.codigo
       JOIN usuario u ON m.usuario_codigo = u.codigo
       WHERE f.codigo = $1`,
      [facturaId]
    );

    if (!facturaQuery || facturaQuery.rows.length === 0) {
      throw new NotFoundException('La factura especificada no existe.');
    }

    const factura = facturaQuery.rows[0];
 
    // Compara el usuario_codigo dueño de la mascota con el cliente autenticado en la sesión
    if (factura.cliente_codigo !== clienteId) {
      throw new BadRequestException('Acceso denegado. No tienes permisos para descargar esta factura.');
    }

    // Traer los servicios prestados en la cita
    const servicios = await this.db.query(
      `SELECT s.nombre, s.precio 
       FROM cita_servicios cs
       JOIN servicio s ON cs.servicio_codigo = s.codigo
       WHERE cs.cita_codigo = $1`,
      [factura.cita_codigo]
    );

    // Traer medicamentos adicionales despachados
    const medicamentos = await this.db.query(
      `SELECT producto_id, cantidad, precio_unitario 
       FROM detalle_factura_medicamento 
       WHERE factura_codigo = $1`,
      [facturaId]
    );

    //Construcción del Buffer del documento PDF 
    const encabezadoPdf = `%PDF-1.4\n%B&H_Veterinary_System_Invoice_Colors:[#48a378,#34795a,#c2e9ce]\n`;
    const cuerpoDatos = `Factura:${factura.codigo}\nClinica:B&H_Veterinary\nCliente:${factura.cliente_nombre}\nMascota:${factura.mascota_nombre}\n`;
    const financieros = `Subtotal:${factura.subtotal}\nDescuento:${factura.descuento}\nPrevio:${factura.monto_previo_pago}\nTotal:${factura.total}\nEstado:${factura.estado}\n`;
    
    const stringEstructura = `${encabezadoPdf}${cuerpoDatos}${financieros}%%EOF`;
    
    return Buffer.from(stringEstructura, 'utf-8');
  }

}