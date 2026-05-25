import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('cita')
export class Appointment {
  @PrimaryColumn()
  codigo: string;

  @Column({ name: 'mascota_codigo' })
  mascotaCodigo: string;

  @Column({ name: 'usuario_codigo' })
  veterinarioCodigo: string;

  @Column()
  estado: string;
}
