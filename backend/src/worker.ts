import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker/worker.module';

/**
 * Worker entrypoint. Boots a lightweight HTTP app that exposes only the health
 * probes; the real work happens in the RabbitMQ consumers wired into
 * WorkerModule. Run with `node dist/worker.js`.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(WorkerModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  const logger = new Logger('Worker');

  app.enableShutdownHooks();

  const port = config.get<number>('workerPort', 3001);
  await app.listen(port);

  logger.log(`Worker process started; consumers attached to RabbitMQ`);
  logger.log(`Health probes on http://localhost:${port}/health`);
}

void bootstrap();
