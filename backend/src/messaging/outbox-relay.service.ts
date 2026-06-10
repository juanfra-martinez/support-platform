import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { OutboxStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DomainEvent } from './contracts/event-payloads';

/**
 * Polls the EventOutbox for PENDING rows and publishes them to the topic
 * exchange. On failure it increments `attempts`; once `maxAttempts` is reached
 * the row is marked FAILED (a real deployment would surface these for replay).
 * A non-overlapping flag prevents concurrent ticks from double-publishing.
 */
@Injectable()
export class OutboxRelayService implements OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayService.name);
  private readonly exchange: string;
  private readonly batchSize: number;
  private readonly maxAttempts: number;
  private running = false;
  private stopped = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly amqp: AmqpConnection,
    private readonly config: ConfigService,
  ) {
    this.exchange = this.config.get<string>('rabbitmq.exchange', 'support.events');
    this.batchSize = this.config.get<number>('outbox.batchSize', 50);
    this.maxAttempts = this.config.get<number>('outbox.maxAttempts', 5);
  }

  onModuleDestroy(): void {
    this.stopped = true;
  }

  @Interval('outbox-relay', 3000)
  async dispatchPending(): Promise<void> {
    if (this.running || this.stopped) {
      return;
    }
    this.running = true;
    try {
      const pending = await this.prisma.eventOutbox.findMany({
        where: { status: OutboxStatus.PENDING },
        orderBy: { createdAt: 'asc' },
        take: this.batchSize,
      });

      for (const row of pending) {
        await this.publishRow(row);
      }
    } catch (error) {
      this.logger.error('Outbox relay tick failed', error as Error);
    } finally {
      this.running = false;
    }
  }

  private async publishRow(row: {
    id: string;
    routingKey: string;
    payload: Prisma.JsonValue;
    correlationId: string | null;
    attempts: number;
  }): Promise<void> {
    const event: DomainEvent<unknown> = {
      eventId: row.id,
      routingKey: row.routingKey,
      occurredAt: new Date().toISOString(),
      correlationId: row.correlationId ?? undefined,
      payload: row.payload,
    };

    try {
      await this.amqp.publish(this.exchange, row.routingKey, event, {
        messageId: row.id,
        correlationId: row.correlationId ?? undefined,
        persistent: true,
        contentType: 'application/json',
      });

      await this.prisma.eventOutbox.update({
        where: { id: row.id },
        data: { status: OutboxStatus.DISPATCHED, dispatchedAt: new Date() },
      });
      this.logger.debug(`Dispatched ${row.routingKey} (${row.id})`);
    } catch (error) {
      const attempts = row.attempts + 1;
      const exhausted = attempts >= this.maxAttempts;
      await this.prisma.eventOutbox.update({
        where: { id: row.id },
        data: {
          attempts,
          status: exhausted ? OutboxStatus.FAILED : OutboxStatus.PENDING,
          lastError: (error as Error).message,
        },
      });
      this.logger.warn(
        `Failed to dispatch ${row.routingKey} (${row.id}) attempt ${attempts}/${this.maxAttempts}`,
      );
    }
  }
}
