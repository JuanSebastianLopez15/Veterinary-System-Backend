// Verificación de correo

export interface VerificationMailDto {
  /** Nombre completo del usuario (nombre + apellido) */
  nombre: string;
  /** Correo destino */
  correo: string;
  /** Código de 6 dígitos generado por bh-core */
  codigo: string;
}

// Confirmación de cita

export interface AppointmentConfirmationMailDto {
  /** Correo destino (cliente) */
  correo: string;
  /** Nombre completo del cliente */
  nombreCliente: string;
  /** Nombre de la mascota */
  nombreMascota: string;
  /** Fecha de la cita en formato legible, ej: "martes 20 de mayo de 2025" */
  fechaCita: string;
  /** Hora de la cita en formato legible, ej: "10:30 AM" */
  horaCita: string;
  /** Nombre completo del veterinario asignado */
  nombreVeterinario: string;
  /** Dirección de la sede donde se realizará la cita */
  direccionSede: string;
}
