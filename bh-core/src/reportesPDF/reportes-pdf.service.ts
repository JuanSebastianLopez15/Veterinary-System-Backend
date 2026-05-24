import { Injectable, BadRequestException } from '@nestjs/common';
import { DateRangeDto } from './dto/date-range.dto';
import { PdfGeneratorHelper } from './helpers/pdf-generator.helper';
import { REPORTES_COLORS } from './reportes-pdf.constants';
// Ajusta la ruta si tu PrismaService está en src/common/database/ o similar
import { PrismaService } from '../database/prisma.service'; 
import * as PDFDocument from 'pdfkit';

@Injectable()
export class ReportesPdfService {
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

    const citas = await this.prismaClient.cita.findMany({
      where: {
        fecha: { gte: dateInicio, lte: dateFin }
      },
      include: {
        cliente: { include: { usuario: true } },
        mascota: true, 
        usuario: true  
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

    doc.moveDown(1.5)
       .fontSize(10)
       .fillColor(REPORTES_COLORS.VERDE_OSCURO)
       .font('Helvetica-Bold')
       .text(`TOTAL FACTURADO EN PERÍODO: $${totalFacturado.toFixed(2)}`, { align: 'right' })
       .text(`TOTAL DESCUENTOS APLICADOS: $${totalDescuentos.toFixed(2)}`, { align: 'right' });

    doc.font('Helvetica'); 
    PdfGeneratorHelper.finalizeAndPaging(doc);
    return doc;
  }

  async generarInventarioReport(): Promise<PDFKit.PDFDocument> {
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
    this.parseDates(dto.fechaInicio, dto.fechaFin);

    const auditUrl = process.env.AUDIT_URL;
    if (!auditUrl) {
      throw new BadRequestException('La URL del servicio de auditoría no está configurada.');
    }

    const params = new URLSearchParams({
      fechaInicio: dto.fechaInicio,
      fechaFin: dto.fechaFin,
    });

    let auditLogs: any[] = [];
    try {
      const response = await fetch(`${auditUrl}?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`bh-audit respondió con status ${response.status}`);
      }
      auditLogs = await response.json();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      throw new BadRequestException(
        `No se pudo obtener el historial de auditoría: ${message}`
      );
    }

    const doc = PdfGeneratorHelper.createBaseDocument(`Reporte de Auditoría: Historial de Acciones`);
    const headers = ['Nombre de Usuario', 'Rol', 'Acción Ejecutada', 'Fecha', 'Hora'];
    const widths = [110, 60, 200, 80, 80];

    const rows = auditLogs.map((log: any) => {
      const fechaDate = log.timestamp ? new Date(log.timestamp) : null;
      
      let horaFormateada = 'N/A';
      if (fechaDate) {
        const hh = String(fechaDate.getHours()).padStart(2, '0');
        const mm = String(fechaDate.getMinutes()).padStart(2, '0');
        horaFormateada = `${hh}:${mm}`;
      }

      return [
        log.userId || 'N/A',
        log.userRole || 'N/A',
        log.action || 'N/A',
        fechaDate ? fechaDate.toISOString().split('T')[0] : 'N/A',
        horaFormateada
      ];
    });

    PdfGeneratorHelper.generateTable(doc, headers, rows, widths);
    PdfGeneratorHelper.finalizeAndPaging(doc);
    return doc;
  }
}