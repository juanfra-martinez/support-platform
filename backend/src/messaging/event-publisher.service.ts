import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RoutingKey } from './contracts/routing-keys';

/**
 * Transactional outbox writer.
 *
 * Business services call `enqueue(tx, ...)` inside the SAME Prisma transaction
 * that mutates domain state. The event is therefore persisted atomically with
 * the data — it is published if and only if the transaction commits. The
 * OutboxRelayService later forwards persisted rows to RabbitMQ.
 */
@Injectable()
export class EventPublisherService {
  async enqueue(
    tx: Prisma.TransactionClient,
    routingKey: RoutingKey,
    payload: Record<string, unknown>,
    correlationId?: string,
  ): Promise<void> {
    await tx.eventOutbox.create({
      data: {
        routingKey,
        payload: payload as Prisma.InputJsonValue,
        correlationId: correlationId ?? null,
      },
    });
  }
}
