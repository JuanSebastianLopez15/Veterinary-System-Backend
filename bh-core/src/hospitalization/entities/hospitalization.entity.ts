import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';

@Entity('Hospitalizacion')
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

  @Column({ name: 'creado_en', type: 'timestamp', default: () => 'now()' })
  creadoEn: Date;
}