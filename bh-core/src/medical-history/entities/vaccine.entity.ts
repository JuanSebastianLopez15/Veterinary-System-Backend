import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { MedicalHistory } from './medical-history.entity';

@Entity('vacuna')
export class Vaccine {
  @PrimaryColumn()
  codigo: string;

  @Column({ name: 'historial_codigo' })
  historialCodigo: string;

  @Column({ name: 'mascota_codigo' })
  mascotaCodigo: string;

  @Column()
  nombre: string;

  @Column({ type: 'date' })
  fecha: Date;

  @Column({ name: 'fecha_siguiente_vacuna', type: 'date', nullable: true })
  fechaSiguienteVacuna: Date;

  @ManyToOne(() => MedicalHistory, (h) => h.vacunas)
  @JoinColumn({ name: 'historial_codigo' })
  historial: MedicalHistory;
}