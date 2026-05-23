// @ts-ignore
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

/**
 * Punto de entrada principal de la aplicación.
 */
async function bootstrap() {
  /**
   * Creación de la aplicación NestJS.
   */
  const app = await NestFactory.create(AppModule);

  /**
   * Prefijo global para versionamiento de API.
   *
   * Todas las rutas iniciarán con:
   * /api/v1
   */
  app.setGlobalPrefix('api/v1');

  /**
   * Pipe global encargado de validar
   * automáticamente los DTOs recibidos.
   */
  app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
  );

  /**
   * Inicio del servidor en el puerto 3001.
   *
   * bh-audit funciona como servicio independiente
   * del sistema principal bh-core.
   */
  await app.listen(3001);

  console.log(
      'bh-audit ejecutándose en http://localhost:3001/api/v1',
  );
}

bootstrap();