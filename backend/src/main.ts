import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Helmet, CORS, ValidationPipe, trust proxy, shutdown hooks, global prefix.
  configureApp(app);
  const globalPrefix = config.get<string>('globalPrefix', 'api');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Support Platform API')
    .setDescription(
      'Enterprise Support Ticket Platform — REST API. ' +
        'Authenticate via /auth/login and authorize with the returned access token.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth')
    .addTag('organizations')
    .addTag('users')
    .addTag('tickets')
    .addTag('comments')
    .addTag('notifications')
    .addTag('audit')
    .addTag('health')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${globalPrefix}/docs`, app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.get<number>('port', 3000);
  await app.listen(port);
  logger.log(`API listening on http://localhost:${port}/${globalPrefix}`);
  logger.log(`Swagger UI on http://localhost:${port}/${globalPrefix}/docs`);
}

void bootstrap();
