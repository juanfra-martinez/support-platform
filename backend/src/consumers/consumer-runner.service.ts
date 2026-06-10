import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { DomainEvent } from '../messaging/contracts/event-payloads';
import {
  DEAD_LETTER_EXCHANGE,
  LAST_ERROR_HEADER,
  RETRY_HEADER,
} from '../messaging/contracts/topology';
import { IdempotencyService } from './idempotency.service';

/** Minimal shape of the raw AMQP message we rely on (subset of amqplib's). */
export interface RawAmqpMessage {
  properties: {
    headers?: Record<string, unknown>;
    messageId?: string;
    correlationId?: string;
  };
}

type Projector = (
  tx: Prisma.TransactionClient,
  event: DomainEvent<unknown>,
) => Promise<void>;

/**
 * Shared execution wrapper for every consumer. It applies idempotency, then on
 * failure runs a bounded retry: the message is re-published directly to its own
 * queue with an incremented retry header (isolating the retry to the failing
 * consumer). Once retries are exhausted the message is routed to the dead-letter
 * exchange with the error attached. The original delivery is always acked so a
 * poisoned message can never block the queue.
 */
@Injectable()
export class ConsumerRunner {
  private readonly logger = new Logger(ConsumerRunner.name);
  private readonly maxRetries: number;

  constructor(
    private readonly idempotency: IdempotencyService,
    private readonly amqp: AmqpConnection,
    config: ConfigService,
  ) {
    this.maxRetries = config.get<number>('consumer.maxRetries', 3);
  }

  async handle(
    consumer: string,
    queue: string,
    event: DomainEvent<unknown>,
    raw: RawAmqpMessage,
    project: Projector,
  ): Promise<void> {
    try {
      const processed = await this.idempotency.runOnce(consumer, event.eventId, (tx) =>
        project(tx, event),
      );
      if (processed) {
        this.logger.debug(
          `[${queue}] applied ${event.routingKey} (${event.eventId})`,
        );
      }
    } catch (error) {
      await this.retryOrDeadLetter(queue, event, raw, error as Error);
    }
  }

  private async retryOrDeadLetter(
    queue: string,
    event: DomainEvent<unknown>,
    raw: RawAmqpMessage,
    error: Error,
  ): Promise<void> {
    const attempt = Number(raw.properties.headers?.[RETRY_HEADER] ?? 0);

    if (attempt < this.maxRetries) {
      this.logger.warn(
        `[${queue}] failed (attempt ${attempt + 1}/${this.maxRetries}) for ` +
          `${event.eventId}: ${error.message} — requeueing`,
      );
      // Publish to the default exchange with the queue name as routing key,
      // which delivers straight back to this queue only.
      await this.amqp.publish('', queue, event, {
        headers: {
          ...(raw.properties.headers ?? {}),
          [RETRY_HEADER]: attempt + 1,
          [LAST_ERROR_HEADER]: error.message,
        },
        messageId: raw.properties.messageId,
        correlationId: raw.properties.correlationId,
        persistent: true,
        contentType: 'application/json',
      });
      return;
    }

    this.logger.error(
      `[${queue}] retries exhausted for ${event.eventId}; dead-lettering`,
    );
    await this.amqp.publish(
      DEAD_LETTER_EXCHANGE,
      queue,
      {
        originQueue: queue,
        error: error.message,
        failedAt: new Date().toISOString(),
        event,
      },
      {
        messageId: raw.properties.messageId,
        persistent: true,
        contentType: 'application/json',
      },
    );
  }
}
