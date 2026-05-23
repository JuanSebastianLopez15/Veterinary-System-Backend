import { formatFechaCita, formatHoraCita } from './mail.helpers';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('mail.helpers', () => {
  describe('formatFechaCita', () => {
    it('formatea una fecha Date correctamente en español', () => {
      // Fecha fija para evitar flakiness por zona horaria
      const fecha = new Date('2025-05-20T00:00:00-05:00'); // UTC-5 Bogotá
      const resultado = formatFechaCita(fecha);
      expect(resultado).toContain('mayo');
      expect(resultado).toContain('2025');
      expect(resultado).toContain('20');
    });

    it('acepta string de fecha ISO', () => {
      const resultado = formatFechaCita('2025-12-15');
      expect(resultado).toContain('diciembre');
      expect(resultado).toContain('2025');
    });
  });

  describe('formatHoraCita', () => {
    it('convierte "10:30:00" a "10:30 AM"', () => {
      expect(formatHoraCita('10:30:00')).toBe('10:30 AM');
    });

    it('convierte "14:00:00" a "2:00 PM"', () => {
      expect(formatHoraCita('14:00:00')).toBe('2:00 PM');
    });

    it('convierte "00:00:00" a "12:00 AM" (medianoche)', () => {
      expect(formatHoraCita('00:00:00')).toBe('12:00 AM');
    });

    it('convierte "12:00:00" a "12:00 PM" (mediodía)', () => {
      expect(formatHoraCita('12:00:00')).toBe('12:00 PM');
    });

    it('preserva minutos con cero a la izquierda', () => {
      expect(formatHoraCita('09:05:00')).toBe('9:05 AM');
    });
  });
});
