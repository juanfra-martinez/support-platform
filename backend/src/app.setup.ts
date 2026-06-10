import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';

/**
 * Applies the production HTTP hardening shared by the running app and the e2e
 * tests, so what we verify in tests is exactly what ships:
 *
 *  - Helmet security headers (CSP disabled so the Swagger UI assets load).
 *  - CORS restricted to the configured origin(s), credentials enabled.
 *  - A strict global ValidationPipe (whitelist + reject unknown props).
 *  - `trust proxy` so rate limiting and req.ip see the real client behind nginx.
 *
 * Rate limiting itself is a global ThrottlerGuard wired in AppModule, with
 * tighter per-route limits on the auth endpoints.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);

  const globalPrefix = config.get<string>('globalPrefix', 'api');
  app.setGlobalPrefix(globalPrefix);

  // Express sits behind nginx in the compose stack; trust the first hop.
  const httpAdapter = app.getHttpAdapter();
  const instance = httpAdapter.getInstance() as {
    set?: (key: string, value: unknown) => void;
  };
  instance.set?.('trust proxy', 1);

  app.use(
    helmet({
      // This is a JSON API that also serves Swagger UI; the default CSP would
      // block the Swagger assets, so we disable it here rather than weaken it.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  const corsOrigin = config.get<string>('corsOrigin', 'http://localhost:4200');
  app.enableCors({
    origin: corsOrigin.split(',').map((origin) => origin.trim()),
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableShutdownHooks();
}
