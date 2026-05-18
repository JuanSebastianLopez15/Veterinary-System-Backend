import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

export const DATABASE_POOL = 'DATABASE_POOL';

export const databaseProvider = {
  provide: DATABASE_POOL,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): Pool => {
    return new Pool({
      host: configService.get<string>('DB_HOST'),
      port: Number(configService.get<string>('DB_PORT')),
      database: configService.get<string>('DB_NAME'),
      user: configService.get<string>('DB_USER'),
      password: configService.get<string>('DB_PASSWORD'),
    });
  },
};
