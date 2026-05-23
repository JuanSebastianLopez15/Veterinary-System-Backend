import { Entity, Column, PrimaryColumn, OneToMany } from 'typeorm';
import { MedicalHistory } from './medical-history.entity';
import { Hospitalization } from './hospitalization.entity';

@Entity('mascotas')
export class Pet {
  @PrimaryColumn()
  codigo: string;

  @Column({ name: 'cliente_codigo' })
  clienteCodigo: string;

  @Column()
  nombre: string;

  @Column()
  especie: string;

  @Column()
  raza: string;

  @Column()
  color: string;

  @Column({ name: 'fecha_nacimiento', type: 'date' })
  fechaNacimiento: Date;

  @Column({ type: 'float' })
  peso: number;

  @Column()
  estado: string;

  @OneToMany(() => MedicalHistory, (mh) => mh.pet)
  historiales: MedicalHistory[];

  @OneToMany(() => Hospitalization, (h) => h.pet)
  hospitalizaciones: Hospitalization[];
}
