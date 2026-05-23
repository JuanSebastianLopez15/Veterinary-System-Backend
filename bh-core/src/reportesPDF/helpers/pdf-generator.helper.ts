import * as PDFDocument from 'pdfkit';
import { REPORTES_COLORS, CLINICA_INFO } from '../reportes-pdf.constants';

export class PdfGeneratorHelper {
  static createBaseDocument(title: string): PDFKit.PDFDocument {
    const doc = new (PDFDocument as any)({ margin: 40, bufferPages: true }) as PDFKit.PDFDocument;

    doc.on('pageAdded', () => {
      this.generateHeader(doc, title);
    });

    this.generateHeader(doc, title);
    return doc;
  }

  private static generateHeader(doc: PDFKit.PDFDocument, title: string) {
    // Fondo de encabezado corporativo
    doc.rect(0, 0, doc.page.width, 80).fill(REPORTES_COLORS.VERDE_OSCURO);

    doc.fillColor(REPORTES_COLORS.BLANCO)
       .fontSize(18)
       .font('Helvetica-Bold')
       .text(CLINICA_INFO.NAME, 40, 22);
    
    doc.fontSize(9)
        .font('Helvetica')
       .text(CLINICA_INFO.SUBTITLE, 40, 47);

    doc.fontSize(12)
        .font('Helvetica-Bold')
       .text(title.toUpperCase(), 40, 100, { align: 'left' })
       .fillColor(REPORTES_COLORS.VERDE_PRINCIPAL);

    doc.moveTo(40, 118).lineTo(doc.page.width - 40, 118).strokeColor(REPORTES_COLORS.VERDE_CLARO).stroke();
    doc.font('Helvetica');
    doc.y = 135;
  }

  static generateTable(
    doc: PDFKit.PDFDocument, 
    headers: string[], 
    rows: any[][], 
    columnWidths: number[], 
    rowMeta?: { isLowStock?: boolean; isNearExpiring?: boolean }[]
  ) {
    let startY = doc.y;
    const startX = 40;

    // Renderizar Cabecera de Tabla
    doc.rect(startX, startY, columnWidths.reduce((a, b) => a + b, 0), 22).fill(REPORTES_COLORS.VERDE_PRINCIPAL);
    doc.fillColor(REPORTES_COLORS.BLANCO).fontSize(9);

    let currentX = startX;
    headers.forEach((header, index) => {
      doc.text(header, currentX + 5, startY + 6, { width: columnWidths[index] - 10, align: 'left' });
      currentX += columnWidths[index];
    });

    startY += 22;

    // Renderizar Filas de Datos
    rows.forEach((row, rowIndex) => {
      if (startY > doc.page.height - 70) {
        doc.addPage();
        startY = doc.y;
      }

      const isEven = rowIndex % 2 === 0;
      const meta = rowMeta ? rowMeta[rowIndex] : null;

      // Colores de fondo estratégicos según las alertas solicitadas
      if (meta?.isLowStock || meta?.isNearExpiring) {
        doc.rect(startX, startY, columnWidths.reduce((a, b) => a + b, 0), 20).fill(REPORTES_COLORS.VERDE_CLARO);
      } else if (isEven) {
        doc.rect(startX, startY, columnWidths.reduce((a, b) => a + b, 0), 20).fill('#F9F9F9');
      }

      doc.fillColor(REPORTES_COLORS.TEXTO_NEGRO).fontSize(8);
      currentX = startX;

      row.forEach((cell, cellIndex) => {
        // Si hay un valor crítico resaltarlo en rojo oscuro sobre la alerta
        if ((cellIndex === 1 && meta?.isLowStock) || (cellIndex === 4 && meta?.isNearExpiring)) {
          doc.fillColor(REPORTES_COLORS.ALERTA_CRITICO);
        } else {
          doc.fillColor(REPORTES_COLORS.TEXTO_NEGRO);
        }
        
        doc.text(cell !== null && cell !== undefined ? cell.toString() : '', currentX + 5, startY + 6, { width: columnWidths[cellIndex] - 10 });
        currentX += columnWidths[cellIndex];
      });

      startY += 20;
    });

    doc.y = startY + 10;
  }

  static finalizeAndPaging(doc: PDFKit.PDFDocument) {
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.fillColor(REPORTES_COLORS.TEXTO_MUTED)
         .fontSize(8)
         .text(`Fecha de generación: ${new Date().toLocaleDateString('es-CO')} | Página ${i + 1} de ${range.count}`, 40, doc.page.height - 25, { align: 'center' });
    }
    doc.end();
  }
}