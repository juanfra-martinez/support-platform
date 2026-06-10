/**
 * Strongly-typed application configuration loaded from environment variables.
 * Consumed via `ConfigService.get('jwt.accessSecret')` etc.
 */
export interface AppConfig {
  env: string;
  port: number;
  workerPort: number;
  globalPrefix: string;
  corsOrigin: string;
  database: { url: string };
  jwt: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  security: {
    bcryptSaltRounds: number;
    throttleTtl: number;
    throttleLimit: number;
  };
  rabbitmq: { uri: string; exchange: string };
  outbox: { pollIntervalMs: number; batchSize: number; maxAttempts: number };
  consumer: { maxRetries: number };
}

export default (): AppConfig => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  workerPort: parseInt(process.env.WORKER_PORT ?? '3001', 10),
  globalPrefix: process.env.API_GLOBAL_PREFIX ?? 'api',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:4200',
  database: { url: process.env.DATABASE_URL as string },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET as string,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET as string,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  security: {
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '12', 10),
    throttleTtl: parseInt(process.env.THROTTLE_TTL ?? '60', 10),
    throttleLimit: parseInt(process.env.THROTTLE_LIMIT ?? '120', 10),
  },
  rabbitmq: {
    uri: process.env.RABBITMQ_URI as string,
    exchange: process.env.RABBITMQ_EXCHANGE ?? 'support.events',
  },
  outbox: {
    pollIntervalMs: parseInt(process.env.OUTBOX_POLL_INTERVAL_MS ?? '3000', 10),
    batchSize: parseInt(process.env.OUTBOX_BATCH_SIZE ?? '50', 10),
    maxAttempts: parseInt(process.env.OUTBOX_MAX_ATTEMPTS ?? '5', 10),
  },
  consumer: {
    maxRetries: parseInt(process.env.CONSUMER_MAX_RETRIES ?? '3', 10),
  },
});
