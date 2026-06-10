import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  DEAD_LETTER_EXCHANGE,
  EXCHANGE,
} from '../messaging/contracts/topology';

/**
 * RabbitMQ wiring for the worker process. Declares the topic exchange and the
 * dead-letter exchange, and exposes AmqpConnection app-wide so consumers can
 * re-publish for retry/DLQ. The per-queue declarations and bindings are owned
 * by each consumer's @RabbitSubscribe decorator.
 */
@Global()
@Module({
  imports: [
    RabbitMQModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('rabbitmq.uri'),
        exchanges: [
          { name: EXCHANGE, type: 'topic', options: { durable: true } },
          {
            name: DEAD_LETTER_EXCHANGE,
            type: 'topic',
            options: { durable: true },
          },
        ],
        // Block startup until connected so the worker is only "ready" once it
        // can actually consume.
        connectionInitOptions: { wait: true, timeout: 20000 },
        enableControllerDiscovery: true,
      }),
    }),
  ],
  exports: [RabbitMQModule],
})
export class WorkerMessagingModule {}
