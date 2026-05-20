export interface CreateVaccineDto {
  historial_codigo: string;
  mascota_codigo: string;
  nombre: string;
  fecha: string;
  fecha_siguiente_vacuna?: string;
}