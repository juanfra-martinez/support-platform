import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { IdempotencyService } from '../idempotency.service';

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let prisma: { $transaction: jest.Mock };
  let tx: { processedEvent: { create: jest.Mock } };

  beforeEach(() => {
    tx = { processedEvent: { create: jest.fn() } };
    prisma = {
      // Run the callback with our fake transaction client.
      $transaction: jest.fn((cb: (t: typeof tx) => Promise<void>) => cb(tx)),
    };
    service = new IdempotencyService(prisma as unknown as PrismaService);
  });

  it('runs the work once and records the event', async () => {
    tx.processedEvent.create.mockResolvedValue({});
    const work = jest.fn().mockResolvedValue(undefined);

    const result = await service.runOnce('audit', 'evt-1', work);

    expect(result).toBe(true);
    expect(tx.processedEvent.create).toHaveBeenCalledWith({
      data: { eventId: 'evt-1', consumer: 'audit' },
    });
    expect(work).toHaveBeenCalledWith(tx);
  });

  it('treats a duplicate (P2002) as already processed and skips the work', async () => {
    const duplicate = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: '6.0.0' },
    );
    tx.processedEvent.create.mockRejectedValue(duplicate);
    const work = jest.fn();

    const result = await service.runOnce('audit', 'evt-1', work);

    expect(result).toBe(false);
    expect(work).not.toHaveBeenCalled();
  });

  it('rethrows unexpected errors so the message can be retried', async () => {
    tx.processedEvent.create.mockResolvedValue({});
    const work = jest.fn().mockRejectedValue(new Error('db down'));

    await expect(service.runOnce('audit', 'evt-1', work)).rejects.toThrow(
      'db down',
    );
  });
});
