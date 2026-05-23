// @ts-ignore
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Prefijo para la API según la especificación OpenAPI
  app.setGlobalPrefix('api/v1');
  // bh-audit corre típicamente en 3001 según la spec
  await app.listen(3001);
}
bootstrap();
