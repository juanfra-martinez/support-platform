import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';
import {
  DeadLetterBindings,
  DEAD_LETTER_EXCHANGE,
  Queues,
} from '../messaging/contracts/topology';
import { RawAmqpMessage } from './consumer-runner.service';

/**
 * Dead-letter sink. Terminal messages (retries exhausted, or rejected by the
 * broker) land here. In a real deployment this would alert and offer replay;
 * here it logs a structured record so the failure is never silent.
 */
@Injectable()
export class DeadLetterConsumer {
  private readonly logger = new Logger(DeadLetterConsumer.name);

  @RabbitSubscribe({
    exchange: DEAD_LETTER_EXCHANGE,
    routingKey: DeadLetterBindings,
    queue: Queues.DeadLetter,
    queueOptions: { durable: true },
  })
  onDeadLetter(message: unknown, raw: RawAmqpMessage): void {
    const messageId = raw.properties.messageId ?? 'unknown';
    this.logger.error(
      `Dead-lettered message ${messageId}: ${JSON.stringify(message).slice(0, 1000)}`,
    );
  }
}
