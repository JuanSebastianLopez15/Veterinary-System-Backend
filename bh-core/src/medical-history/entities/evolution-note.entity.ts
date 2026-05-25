import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Hospitalization } from './hospitalization.entity';

@Entity('nota_evolucion')
export class EvolutionNote {
  @PrimaryColumn()
  codigo: string;

  @Column({ name: 'hospitalizacion_codigo' })
  hospitalizacionCodigo: string;

  @Column({ name: 'veterinario_codigo' })
  veterinarioCodigo: string;

  @Column({ type: 'date' })
  fecha: Date;

  @Column({ name: 'descripcion' })
  nota: string;

  @ManyToOne(() => Hospitalization, (h) => h.notasEvolucion)
  @JoinColumn({ name: 'hospitalizacion_codigo' })
  hospitalization: Hospitalization;
}
