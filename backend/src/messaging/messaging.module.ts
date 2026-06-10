import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventPublisherService } from './event-publisher.service';
import { OutboxRelayService } from './outbox-relay.service';

/**
 * Wires the RabbitMQ connection, declares the topic exchange and exposes the
 * outbox publisher. The relay runs as a background scheduled task. Marked
 * @Global so any feature module can inject EventPublisherService.
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
          {
            name: config.get<string>('rabbitmq.exchange', 'support.events'),
            type: 'topic',
            options: { durable: true },
          },
        ],
        connectionInitOptions: { wait: false },
        enableControllerDiscovery: true,
      }),
    }),
  ],
  providers: [EventPublisherService, OutboxRelayService],
  exports: [EventPublisherService, RabbitMQModule],
})
export class MessagingModule {}
