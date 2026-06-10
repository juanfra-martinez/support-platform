import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Guarantees each event is applied at most once per consumer.
 *
 * A row in `processed_events` (unique on eventId+consumer) is written in the
 * SAME transaction as the projection. If the row already exists the unique
 * constraint trips, the transaction rolls back and we treat the delivery as a
 * duplicate — safe to ack. This makes consumers idempotent under RabbitMQ's
 * at-least-once delivery and under our own retries.
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Runs `work` exactly once for (consumer, eventId).
   * @returns true if the work ran now, false if it was a duplicate.
   */
  async runOnce(
    consumer: string,
    eventId: string,
    work: (tx: Prisma.TransactionClient) => Promise<void>,
  ): Promise<boolean> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.processedEvent.create({ data: { eventId, consumer } });
        await work(tx);
      });
      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.debug(
          `Event ${eventId} already processed by '${consumer}', skipping`,
        );
        return false;
      }
      throw error;
    }
  }
}
