import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Entidad encargada de almacenar los eventos
 * de trazabilidad enviados desde bh-core.
 *
 * Este servicio funciona de manera independiente
 * para garantizar que el historial de acciones
 * permanezca disponible incluso si bh-core falla.
 */
@Entity('audit_events')
export class AuditEvent {

    /**
     * Identificador único del evento.
     */
    @PrimaryGeneratedColumn('uuid')
    id: string;

    /**
     * Acción ejecutada dentro del sistema.
     * Ejemplo:
     * LOGIN_SUCCESS
     * CREATE_APPOINTMENT
     */
    @Column()
    action: string;

    /**
     * Identificador del usuario que ejecutó la acción.
     * Puede ser null en operaciones anónimas.
     */
    @Column({ nullable: true })
    userId: string;

    /**
     * Rol asociado al usuario.
     * Ejemplo:
     * ADMIN
     * VETERINARIAN
     * RECEPTIONIST
     */
    @Column({ nullable: true })
    userRole: string;

    /**
     * Tipo de entidad afectada por la acción.
     * Ejemplo:
     * appointment
     * invoice
     * medical_record
     */
    @Column()
    entityType: string;

    /**
     * Identificador de la entidad afectada.
     */
    @Column({ nullable: true })
    entityId: string;

    /**
     * Información adicional asociada al evento.
     * Se almacena en formato JSON.
     */
    @Column({ type: 'jsonb', default: {} })
    details: Record<string, unknown>;

    /**
     * Dirección IP desde donde se realizó la acción.
     */
    @Column({ nullable: true })
    ipAddress: string;

    /**
     * Fecha de creación automática del evento.
     */
    @CreateDateColumn()
    createdAt: Date;
}