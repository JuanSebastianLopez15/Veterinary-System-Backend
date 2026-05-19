import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';

import { DATABASE_POOL } from '../database/database.provider';

@Injectable()
export class AppointmentsService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async isAvailable(
    usuarioCodigo: string,
    fecha: string,
    hora: string,
  ): Promise<boolean> {
    const result = await this.pool.query(
      `
        SELECT 1
        FROM cita
        WHERE usuario_codigo = $1
          AND fecha = $2::date
          AND hora = $3::time
          AND estado <> 'cancelada'
        LIMIT 1
      `,
      [usuarioCodigo, fecha, hora],
    );

    return result.rowCount === 0;
  }
}
