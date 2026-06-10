import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConsumersModule } from '../consumers/consumers.module';
import configuration from '../config/configuration';
import { envValidationSchema } from '../config/env.validation';
import { HealthModule } from '../health/health.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkerMessagingModule } from './worker-messaging.module';

/**
 * Root module for the worker process. It shares the same configuration,
 * Prisma layer and event contracts as the API, but runs the RabbitMQ consumers
 * instead of the HTTP/producer stack. Deployed as its own container so it can
 * be scaled independently of the API.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    PrismaModule,
    WorkerMessagingModule,
    ConsumersModule,
    HealthModule,
  ],
})
export class WorkerModule {}
