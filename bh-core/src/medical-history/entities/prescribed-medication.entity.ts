import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { MedicalHistory } from './medical-history.entity';

@Entity('Medicamento_Prescrito')
export class PrescribedMedication {
  @PrimaryColumn()
  codigo: string;

  @Column({ name: 'historial_codigo' })
  historialCodigo: string;

  @Column({ name: 'producto_codigo', nullable: true })
  productoCodigo: string;

  @Column()
  dosis: string;

  @Column()
  duracion: string;

  @Column({ name: 'cantidad_medicamentos_prescritos' })
  cantidad: number;

  @ManyToOne(() => MedicalHistory, (h) => h.medicamentos)
  @JoinColumn({ name: 'historial_codigo' })
  historial: MedicalHistory;
}