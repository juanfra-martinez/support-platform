import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { ConfigService } from '@nestjs/config';
import { DomainEvent } from '../../messaging/contracts/event-payloads';
import { DEAD_LETTER_EXCHANGE } from '../../messaging/contracts/topology';
import { ConsumerRunner, RawAmqpMessage } from '../consumer-runner.service';
import { IdempotencyService } from '../idempotency.service';

const QUEUE = 'notification.queue';
const event: DomainEvent<unknown> = {
  eventId: 'evt-1',
  routingKey: 'ticket.created',
  occurredAt: new Date().toISOString(),
  payload: {},
};

function rawWithRetry(retry?: number): RawAmqpMessage {
  return {
    properties: {
      headers: retry === undefined ? {} : { 'x-retry': retry },
      messageId: 'evt-1',
    },
  };
}

describe('ConsumerRunner', () => {
  let runner: ConsumerRunner;
  let idempotency: { runOnce: jest.Mock };
  let amqp: { publish: jest.Mock };

  beforeEach(() => {
    idempotency = { runOnce: jest.fn() };
    amqp = { publish: jest.fn().mockResolvedValue(undefined) };
    const config = { get: jest.fn().mockReturnValue(3) } as unknown as ConfigService;
    runner = new ConsumerRunner(
      idempotency as unknown as IdempotencyService,
      amqp as unknown as AmqpConnection,
      config,
    );
  });

  it('acks (no republish) when processing succeeds', async () => {
    idempotency.runOnce.mockResolvedValue(true);

    await runner.handle('notification', QUEUE, event, rawWithRetry(), jest.fn());

    expect(amqp.publish).not.toHaveBeenCalled();
  });

  it('requeues to its own queue with an incremented retry header on failure', async () => {
    idempotency.runOnce.mockRejectedValue(new Error('boom'));

    await runner.handle('notification', QUEUE, event, rawWithRetry(0), jest.fn());

    expect(amqp.publish).toHaveBeenCalledTimes(1);
    const [exchange, routingKey, body, options] = amqp.publish.mock.calls[0];
    expect(exchange).toBe(''); // default exchange -> direct to queue
    expect(routingKey).toBe(QUEUE);
    expect(body).toBe(event);
    expect(options.headers['x-retry']).toBe(1);
  });

  it('dead-letters once retries are exhausted', async () => {
    idempotency.runOnce.mockRejectedValue(new Error('boom'));

    await runner.handle('notification', QUEUE, event, rawWithRetry(3), jest.fn());

    expect(amqp.publish).toHaveBeenCalledTimes(1);
    const [exchange, routingKey, body] = amqp.publish.mock.calls[0];
    expect(exchange).toBe(DEAD_LETTER_EXCHANGE);
    expect(routingKey).toBe(QUEUE);
    expect(body).toMatchObject({ originQueue: QUEUE, error: 'boom' });
  });
});
