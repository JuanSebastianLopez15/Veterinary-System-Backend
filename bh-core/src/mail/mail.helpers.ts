
export function formatFechaCita(fecha: Date | string): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  return d.toLocaleDateString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Bogota',
  });
}

export function formatHoraCita(hora: string): string {
  // hora viene como "HH:MM:SS" desde la BD
  const [h, m] = hora.split(':').map(Number);
  const periodo = h >= 12 ? 'PM' : 'AM';
  const hora12 = h % 12 === 0 ? 12 : h % 12;
  const minutos = String(m).padStart(2, '0');
  return `${hora12}:${minutos} ${periodo}`;
}
