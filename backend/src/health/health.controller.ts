import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Optional,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

interface DependencyStatus {
  status: 'up' | 'down';
}

interface ReadinessReport {
  status: 'ok' | 'error';
  info: Record<string, DependencyStatus>;
}

/**
 * Liveness and readiness probes used by Docker/Kubernetes health checks.
 * `/health` is a cheap liveness ping; `/health/ready` verifies the database and
 * (when present) the RabbitMQ connection, returning 503 if a dependency is down.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(AmqpConnection)
    private readonly amqp?: AmqpConnection,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  live(): { status: 'ok'; uptime: number } {
    return { status: 'ok', uptime: Math.round(process.uptime()) };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe (database + RabbitMQ)' })
  async ready(): Promise<ReadinessReport> {
    const [dbUp, mqUp] = await Promise.all([
      this.checkDatabase(),
      Promise.resolve(this.checkRabbit()),
    ]);

    const info: Record<string, DependencyStatus> = {
      database: { status: dbUp ? 'up' : 'down' },
    };
    if (this.amqp) {
      info['rabbitmq'] = { status: mqUp ? 'up' : 'down' };
    }

    const healthy = dbUp && (!this.amqp || mqUp);
    const report: ReadinessReport = {
      status: healthy ? 'ok' : 'error',
      info,
    };

    if (!healthy) {
      throw new HttpException(report, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return report;
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private checkRabbit(): boolean {
    try {
      return !!this.amqp && this.amqp.managedConnection.isConnected();
    } catch {
      return false;
    }
  }
}
