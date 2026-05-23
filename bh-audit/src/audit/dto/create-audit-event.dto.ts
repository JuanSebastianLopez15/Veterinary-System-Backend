import { IsString, IsOptional, IsUUID, IsIn, IsObject, IsNotEmpty, IsDateString } from 'class-validator';

export class CreateAuditEventDto {
  @IsString()
  @IsNotEmpty()
  @IsIn([
    'REGISTRO_USUARIO', 'VERIFICACION_CORREO', 'APROBACION_CUENTA', 'RECHAZO_CUENTA',
    'LOGIN_EXITOSO', 'LOGIN_FALLIDO', 'CREACION_CITA', 'CAMBIO_ESTADO_CITA',
    'CREACION_HISTORIAL_MEDICO', 'EDICION_HISTORIAL_MEDICO', 'REGISTRO_VACUNA',
    'INICIO_HOSPITALIZACION', 'ALTA_HOSPITALIZACION', 'CREACION_FACTURA',
    'ANULACION_FACTURA', 'AJUSTE_INVENTARIO', 'CREACION_SERVICIO', 'EDICION_SERVICIO',
    'DESACTIVACION_SERVICIO', 'PAGO_CITA_REGISTRADO', 'SUSPENSION_USUARIO'
  ])
  action: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['cliente', 'recepcionista', 'veterinario', 'administrador'])
  userRole?: string;

  @IsString()
  @IsNotEmpty()
  @IsIn([
    'User', 'Appointment', 'MedicalRecord', 'Vaccination', 'Hospitalization',
    'Invoice', 'InventoryProduct', 'Service', 'Pet', 'Payment'
  ])
  entityType: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsObject()
  @IsNotEmpty()
  details: Record<string, any>;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  ipAddress?: string;

  @IsOptional()
  @IsDateString()
  timestamp?: string;
}
