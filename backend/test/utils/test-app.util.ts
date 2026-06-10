import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';

/**
 * Applies the same global prefix, validation, response envelope and exception
 * filter as production, so e2e assertions exercise the real request pipeline.
 */
export function applyGlobals(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
}

/** Minimal env required by the shared configuration factory during tests. */
export function setTestEnv(): void {
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-0123456789abcd';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-0123456789abcd';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.BCRYPT_SALT_ROUNDS = '4';
}
