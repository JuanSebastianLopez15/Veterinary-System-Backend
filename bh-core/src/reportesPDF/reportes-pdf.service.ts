import { Injectable, BadRequestException } from '@nestjs/common';
import { DateRangeDto } from './dto/date-range.dto';
import { PdfGeneratorHelper } from './helpers/pdf-generator.helper';
import { REPORTES_COLORS } from './reportes-pdf.constants';
// Ajusta la ruta si tu PrismaService está en src/common/database/ o similar
import { PrismaService } from '../database/prisma.service'; 
import * as PDFDocument from 'pdfkit';

@Injectable()
export class ReportesPdfService {
  // Usamos un casteo flexible 'any' interno para blindar el código ante fallos de indexación de tipos
  private prismaClient: any;

  constructor(private readonly prisma: PrismaService) {
    this.prismaClient = this.prisma as any;
  }

  private parseDates(inicio: string, fin: string) {
    const dateInicio = new Date(inicio);
    const dateFin = new Date(fin);
    if (dateInicio > dateFin) {
      throw new BadRequestException('La fecha de inicio no puede ser posterior a la fecha de fin');
    }
    return { dateInicio, dateFin };
  }

  async generarCitasReport(dto: DateRangeDto): Promise<PDFKit.PDFDocument> {
    const { dateInicio, dateFin } = this.parseDates(dto.fechaInicio, dto.fechaFin);

    // Consulta adaptada estrictamente al esquema: cita -> cliente/mascotas/usuario(veterinario)
    const citas = await this.prismaClient.cita.findMany({
      where: {
        fecha: { gte: dateInicio, lte: dateFin }
      },
      include: {
        cliente: { include: { usuario: true } },
        mascota: true, // Relación directa al modelo 'mascotas'
        usuario: true  // El usuario/veterinario que atiende la cita
      },
      orderBy: { fecha: 'asc' }
    });

    const doc = PdfGeneratorHelper.createBaseDocument(`Reporte de Citas: ${dto.fechaInicio} al ${dto.fechaFin}`);
    const headers = ['Cliente', 'Mascota', 'Veterinario', 'Fecha', 'Estado'];
    const widths = [130, 90, 130, 80, 100];
    
    const rows = citas.map((c: any) => [
      `${c.cliente?.usuario?.nombre || ''} ${c.cliente?.usuario?.apellido || ''}`.trim() || 'N/A',
      c.mascota?.nombre || 'N/A',
      `${c.usuario?.nombre || ''} ${c.usuario?.apellido || ''}`.trim() || 'N/A',
      c.fecha ? new Date(c.fecha).toISOString().split('T')[0] : 'N/A',
      c.estado || 'confirmada'
    ]);

    PdfGeneratorHelper.generateTable(doc, headers, rows, widths);
    PdfGeneratorHelper.finalizeAndPaging(doc);
    return doc;
  }

  async generarFacturacionReport(dto: DateRangeDto): Promise<PDFKit.PDFDocument> {
    const { dateInicio, dateFin } = this.parseDates(dto.fechaInicio, dto.fechaFin);

    // Consulta adaptada al modelo 'factura'
    const facturas = await this.prismaClient.factura.findMany({
      where: {
        fecha: { gte: dateInicio, lte: dateFin }
      },
      include: {
        cliente: { include: { usuario: true } }
      },
      orderBy: { fecha: 'asc' }
    });

    const doc = PdfGeneratorHelper.createBaseDocument(`Reporte Consolidado de Facturación`);
    const headers = ['ID Factura', 'Cliente', 'Total ($)', 'Descuento ($)', 'Saldo Pend. ($)', 'Estado', 'Fecha'];
    const widths = [85, 120, 65, 75, 75, 60, 50];

    let totalFacturado = 0;
    let totalDescuentos = 0;

    const rows = facturas.map((f: any) => {
      const tot = Number(f.total || 0);
      const desc = Number(f.descuento || 0);
      totalFacturado += tot;
      totalDescuentos += desc;

      return [
        f.codigo ? f.codigo.substring(0, 8).toUpperCase() : 'N/A',
        `${f.cliente?.usuario?.nombre || ''} ${f.cliente?.usuario?.apellido || ''}`.trim() || 'N/A',
        tot.toFixed(2),
        desc.toFixed(2),
        Number(f.saldo_pendiente || 0).toFixed(2),
        f.estado || 'pendiente',
        f.fecha ? new Date(f.fecha).toISOString().split('T')[0] : 'N/A'
      ];
    });

    PdfGeneratorHelper.generateTable(doc, headers, rows, widths);

    // Formateo de totales consolidados usando la paleta corporativa
    doc.moveDown(1.5)
       .fontSize(10)
       .fillColor(REPORTES_COLORS.VERDE_OSCURO)
       .font('Helvetica-Bold')
       .text(`TOTAL FACTURADO EN PERÍODO: $${totalFacturado.toFixed(2)}`, { align: 'right' })
       .text(`TOTAL DESCUENTOS APLICADOS: $${totalDescuentos.toFixed(2)}`, { align: 'right' });

    doc.font('Helvetica'); // Resetear fuente estándar
    PdfGeneratorHelper.finalizeAndPaging(doc);
    return doc;
  }

  async generarInventarioReport(): Promise<PDFKit.PDFDocument> {
    // Consulta adaptada al modelo 'producto'
    const productos = await this.prismaClient.producto.findMany({
      orderBy: { nombre: 'asc' }
    });

    const doc = PdfGeneratorHelper.createBaseDocument('Reporte de Estado de Inventario Actual');
    const headers = ['Nombre de Producto', 'Stock', 'Mínimo', 'Precio ($)', 'Vencimiento'];
    const widths = [170, 60, 60, 75, 100];

    const rows: any[][] = [];
    const rowMeta: any[] = [];

    const hoy = new Date();
    const tresMesesDespues = new Date();
    tresMesesDespues.setMonth(hoy.getMonth() + 3);

    productos.forEach((p: any) => {
      const isLowStock = p.stock < p.stock_minimo;
      const isNearExpiring = p.fecha_vencimiento && new Date(p.fecha_vencimiento) <= tresMesesDespues;

      rows.push([
        p.nombre,
        isLowStock ? `${p.stock} (BAJO)` : p.stock.toString(),
        p.stock_minimo.toString(),
        p.precio.toFixed(2),
        p.fecha_vencimiento ? new Date(p.fecha_vencimiento).toISOString().split('T')[0] : 'N/A'
      ]);

      rowMeta.push({ isLowStock, isNearExpiring });
    });

    PdfGeneratorHelper.generateTable(doc, headers, rows, widths, rowMeta);
    PdfGeneratorHelper.finalizeAndPaging(doc);
    return doc;
  }

  async generarHistorialReport(dto: DateRangeDto): Promise<PDFKit.PDFDocument> {
    const { dateInicio, dateFin } = this.parseDates(dto.fechaInicio, dto.fechaFin);

    const auditUrl = process.env.AUDIT_URL || 'http://localhost:3001/api/v1/audit/events';
    
    // Configurar endDate al final del día
    const endDate = new Date(dateFin);
    endDate.setHours(23, 59, 59, 999);

    const params = new URLSearchParams({
      startDate: dateInicio.toISOString(),
      endDate: endDate.toISOString(),
      limit: '100'
    });

    let auditLogs: any[] = [];
    try {
      const response = await fetch(`${auditUrl}?${params.toString()}`);
      if (response.ok) {
        const body = await response.json();
        auditLogs = body.data || [];
      } else {
        console.warn('Failed to fetch from bh-audit:', await response.text());
      }
    } catch (e: any) {
      console.error('Error fetching audit logs:', e.message);
    }

    // Obtener nombres de usuario reales de la BD
    const userIds = [...new Set(auditLogs.map((l: any) => l.userId).filter(Boolean))] as string[];
    const users = await this.prismaClient.usuario.findMany({
      where: { codigo: { in: userIds } },
      select: { codigo: true, nombre: true, apellido: true }
    });
    const userMap = new Map();
    users.forEach((u: any) => userMap.set(u.codigo, `${u.nombre} ${u.apellido}`.trim()));

    const actionMap: Record<string, string> = {
      REGISTRO_USUARIO: 'Registro de usuario',
      VERIFICACION_CORREO: 'Verificación de correo',
      APROBACION_CUENTA: 'Aprobación o rechazo de cuenta',
      RECHAZO_CUENTA: 'Aprobación o rechazo de cuenta',
      LOGIN_EXITOSO: 'Inicio de sesión exitoso',
      LOGIN_FALLIDO: 'Intento de inicio de sesión fallido',
      CREACION_CITA: 'Creación de cita',
      CAMBIO_ESTADO_CITA: 'Cambio de estado de cita',
      CREACION_HISTORIAL_MEDICO: 'Creación de historial médico',
      EDICION_HISTORIAL_MEDICO: 'Edición de historial médico',
      REGISTRO_VACUNA: 'Registro de vacuna',
      INICIO_HOSPITALIZACION: 'Inicio de hospitalización',
      ALTA_HOSPITALIZACION: 'Alta de hospitalización',
      CREACION_FACTURA: 'Creación de factura',
      ANULACION_FACTURA: 'Anulación de factura',
      AJUSTE_INVENTARIO: 'Ajuste manual de inventario',
      CREACION_SERVICIO: 'Creación o edición de servicio',
      EDICION_SERVICIO: 'Creación o edición de servicio',
      DESACTIVACION_SERVICIO: 'Desactivación de servicio',
      PAGO_CITA_REGISTRADO: 'Pago de cita registrado',
      SUSPENSION_USUARIO: 'Suspensión de usuario'
    };

    const doc = PdfGeneratorHelper.createBaseDocument(`Reporte de Auditoría: Historial de Acciones`);
    const headers = ['Usuario', 'Rol', 'Acción Ejecutada', 'Fecha', 'Hora'];
    const widths = [110, 65, 175, 70, 70];

    const rows = auditLogs.map((log: any) => {
      const d = new Date(log.timestamp);
      const userName = log.userId ? (userMap.get(log.userId) || 'Desconocido') : 'Sistema / Anónimo';
      const actionName = actionMap[log.action] || log.action;
      const formattedDate = d.toISOString().split('T')[0];
      const formattedTime = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      
      return [
        userName,
        log.userRole || 'N/A',
        actionName,
        formattedDate,
        formattedTime
      ];
    });

    PdfGeneratorHelper.generateTable(doc, headers, rows, widths);
    PdfGeneratorHelper.finalizeAndPaging(doc);
    return doc;
  }
}