import {
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  IsObject,
  IsNotEmpty,
  IsDateString,
} from 'class-validator';

export class CreateAuditEventDto {
  @IsString()
  @IsNotEmpty()
  @IsIn([
    'REGISTRO_USUARIO',
    'VERIFICACION_CORREO',
    'REENVIO_CODIGO_VERIFICACION',
    'APROBACION_CUENTA',
    'RECHAZO_CUENTA',
    'LOGIN_EXITOSO',
    'LOGIN_FALLIDO',
    'CREACION_CITA',
    'CAMBIO_ESTADO_CITA',
    'CANCELACION_CITA',
    'FINALIZACION_CITA',
    'CREACION_HISTORIAL_MEDICO',
    'EDICION_HISTORIAL_MEDICO',
    'REGISTRO_VACUNA',
    'INICIO_HOSPITALIZACION',
    'ALTA_HOSPITALIZACION',
    'CREACION_FACTURA',
    'ANULACION_FACTURA',
    'AJUSTE_INVENTARIO',
    'CREACION_INVENTARIO',
    'ACTUALIZACION_INVENTARIO',
    'DEDUCCION_STOCK_PRESCRIPCION',
    'CREACION_SERVICIO',
    'EDICION_SERVICIO',
    'ACTUALIZACION_PRECIO_SERVICIO',
    'DESACTIVACION_SERVICIO',
    'ACTIVACION_SERVICIO',
    'PAGO_CITA_REGISTRADO',
    'SUSPENSION_USUARIO',
    'REGISTRO_CLIENTE',
    'ACTUALIZACION_CLIENTE',
  ])
  action: string;

  @IsOptional()
  @IsUUID()
  userId?: string | null;

  @IsOptional()
  @IsString()
  @IsIn(['cliente', 'recepcionista', 'veterinario', 'administrador'])
  userRole?: string | null;

  @IsString()
  @IsNotEmpty()
  @IsIn([
    'User',
    'Appointment',
    'MedicalRecord',
    'Vaccination',
    'Hospitalization',
    'Invoice',
    'InventoryProduct',
    'Service',
    'Pet',
    'Payment',
    'Client',
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

  @IsDateString()
  timestamp: string;
}
