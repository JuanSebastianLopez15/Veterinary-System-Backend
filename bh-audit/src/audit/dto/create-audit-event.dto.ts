import { IsObject, IsOptional, IsString } from 'class-validator';

/**
 * DTO encargado de validar los eventos
 * recibidos desde bh-core.
 */
export class CreateAuditEventDto {
    /**
     * Acción ejecutada en el sistema.
     */
    @IsString()
    action: string;

    /**
     * Identificador del usuario.
     */
    @IsOptional()
    @IsString()
    userId?: string;

    /**
     * Rol del usuario que ejecuta la acción.
     */
    @IsOptional()
    @IsString()
    userRole?: string;

    /**
     * Tipo de entidad afectada.
     */
    @IsString()
    entityType: string;

    /**
     * Identificador de la entidad afectada.
     */
    @IsOptional()
    @IsString()
    entityId?: string;

    /**
     * Información adicional del evento.
     */
    @IsObject()
    details: Record<string, unknown>;

    /**
     * Dirección IP del cliente.
     */
    @IsOptional()
    @IsString()
    ipAddress?: string;
}