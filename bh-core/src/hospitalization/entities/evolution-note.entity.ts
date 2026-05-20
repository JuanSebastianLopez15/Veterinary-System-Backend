import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';

@Entity('Nota_Evolucion')
export class EvolutionNote {
  @PrimaryColumn()
  codigo: string;

  @Column({ name: 'hospitalizacion_codigo' })
  hospitalizacionCodigo: string;

  @Column({ name: 'veterinario_codigo' })
  veterinarioCodigo: string;

  @Column({ type: 'date' })
  fecha: Date;

  @Column()
  nota: string;

  @Column({ name: 'creado_en', type: 'timestamp', default: () => 'now()' })
  creadoEn: Date;
}