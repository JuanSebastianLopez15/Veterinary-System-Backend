/**
 * Formatea una fecha al formato legible en hora Colombia (UTC-5).
 * Ejemplo de salida: 21/05/2026 04:46 a. m.
 *
 * @param fecha - Fecha a formatear (Date, string o number)
 * @returns Cadena con la fecha formateada en hora Colombia
 */
export function formatColombiaDate(fecha: Date | string | number): string {
  return new Date(fecha).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
