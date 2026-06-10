import { Module } from '@nestjs/common';
import { AnalyticsConsumer } from './analytics.consumer';
import { AuditConsumer } from './audit.consumer';
import { ConsumerRunner } from './consumer-runner.service';
import { DeadLetterConsumer } from './dead-letter.consumer';
import { IdempotencyService } from './idempotency.service';
import { NotificationConsumer } from './notification.consumer';

/**
 * The three independent event consumers plus shared infrastructure. Registered
 * as providers; golevelup discovers their @RabbitSubscribe handlers and binds
 * the queues at connection time.
 */
@Module({
  providers: [
    IdempotencyService,
    ConsumerRunner,
    NotificationConsumer,
    AuditConsumer,
    AnalyticsConsumer,
    DeadLetterConsumer,
  ],
})
export class ConsumersModule {}
