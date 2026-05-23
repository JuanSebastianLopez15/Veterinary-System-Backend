import { IsOptional, IsString, IsUUID, IsIn, IsDateString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class GetAuditEventsFilterDto {
  @IsOptional()
  @IsString()
  @IsIn([
    'REGISTRO_USUARIO', 'VERIFICACION_CORREO', 'APROBACION_CUENTA', 'RECHAZO_CUENTA',
    'LOGIN_EXITOSO', 'LOGIN_FALLIDO', 'CREACION_CITA', 'CAMBIO_ESTADO_CITA',
    'CREACION_HISTORIAL_MEDICO', 'EDICION_HISTORIAL_MEDICO', 'REGISTRO_VACUNA',
    'INICIO_HOSPITALIZACION', 'ALTA_HOSPITALIZACION', 'CREACION_FACTURA',
    'ANULACION_FACTURA', 'AJUSTE_INVENTARIO', 'CREACION_SERVICIO', 'EDICION_SERVICIO',
    'DESACTIVACION_SERVICIO', 'PAGO_CITA_REGISTRADO', 'SUSPENSION_USUARIO'
  ])
  action?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['cliente', 'recepcionista', 'veterinario', 'administrador'])
  userRole?: string;

  @IsOptional()
  @IsString()
  @IsIn([
    'User', 'Appointment', 'MedicalRecord', 'Vaccination', 'Hospitalization',
    'Invoice', 'InventoryProduct', 'Service', 'Pet', 'Payment'
  ])
  entityType?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
