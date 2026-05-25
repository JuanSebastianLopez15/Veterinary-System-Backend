import { Entity, Column, PrimaryColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { Pet } from './pet.entity';
import { EvolutionNote } from './evolution-note.entity';

@Entity('hospitalizacion')
export class Hospitalization {
  @PrimaryColumn()
  codigo: string;

  @Column({ name: 'mascota_codigo' })
  mascotaCodigo: string;

  @Column({ name: 'veterinario_codigo' })
  veterinarioCodigo: string;

  @Column({ name: 'fecha_ingreso', type: 'date' })
  fechaIngreso: Date;

  @Column({ name: 'fecha_salida', type: 'date', nullable: true })
  fechaSalida: Date;

  @Column({ name: 'estado_egreso', nullable: true })
  estadoEgreso: string;

  @Column()
  motivo: string;

  @Column()
  activa: boolean;

  @ManyToOne(() => Pet, (pet) => pet.hospitalizaciones)
  @JoinColumn({ name: 'mascota_codigo' })
  pet: Pet;

  @OneToMany(() => EvolutionNote, (note) => note.hospitalization)
  notasEvolucion: EvolutionNote[];
}
