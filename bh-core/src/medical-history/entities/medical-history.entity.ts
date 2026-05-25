import { Entity, Column, PrimaryColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { PrescribedMedication } from './prescribed-medication.entity';
import { Vaccine } from './vaccine.entity';
import { Pet } from './pet.entity';

@Entity('historial_medico')
export class MedicalHistory {
  @PrimaryColumn()
  codigo: string;

  @Column({ name: 'cita_codigo' })
  citaCodigo: string;

  @Column({ name: 'mascota_codigo' })
  mascotaCodigo: string;

  @Column({ name: 'veterinario_codigo' })
  veterinarioCodigo: string;

  @Column({ name: 'motivo_visita' })
  motivoVisita: string;

  @Column()
  diagnostico: string;

  @Column({ name: 'tratamiento_aplicado' })
  tratamientoAplicado: string;

  @Column({ name: 'peso_mascota', type: 'float' })
  pesoMascota: number;

  @Column({ name: 'proxima_visita', type: 'date', nullable: true })
  proximaVisita: Date;

  @Column({ name: 'editable_hasta', type: 'timestamp' })
  editableHasta: Date;

  @Column({ name: 'creado_en', type: 'timestamp', default: () => 'now()' })
  creadoEn: Date;

  @ManyToOne(() => Pet, (pet) => pet.historiales)
  @JoinColumn({ name: 'mascota_codigo' })
  pet: Pet;

  @OneToMany(() => PrescribedMedication, (med) => med.historial, { cascade: true })
  medicamentos: PrescribedMedication[];

  @OneToMany(() => Vaccine, (vac) => vac.historial, { cascade: true })
  vacunas: Vaccine[];
}