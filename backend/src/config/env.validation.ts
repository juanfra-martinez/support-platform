import * as Joi from 'joi';

/**
 * Fail fast at boot if the environment is misconfigured.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  WORKER_PORT: Joi.number().default(3001),
  API_GLOBAL_PREFIX: Joi.string().default('api'),
  CORS_ORIGIN: Joi.string().default('http://localhost:4200'),

  DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),

  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  BCRYPT_SALT_ROUNDS: Joi.number().min(10).max(15).default(12),
  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(120),

  RABBITMQ_URI: Joi.string().required(),
  RABBITMQ_EXCHANGE: Joi.string().default('support.events'),

  OUTBOX_POLL_INTERVAL_MS: Joi.number().default(3000),
  OUTBOX_BATCH_SIZE: Joi.number().default(50),
  OUTBOX_MAX_ATTEMPTS: Joi.number().default(5),

  CONSUMER_MAX_RETRIES: Joi.number().default(3),
});
