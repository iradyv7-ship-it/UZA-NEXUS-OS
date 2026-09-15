import { Injectable, Logger, type OnModuleInit, type OnApplicationShutdown } from '@nestjs/common';
import { Queue, type ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';
import type { EventEnvelope } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { EVENTS_QUEUE, EVENT_JOB_OPTS } from './event-bus.constants';
import { drainOutbox, type OutboxHandler } from './outbox-processor';

/**
 * The outbox publisher, run inside the API process. Opt-in: RUN_OUTBOX_PUBLISHER=1.
 *
 * The publisher's home is the standalone worker (worker/src/main.ts), and that stays the
 * deployment for anything real. This exists for hosts that offer a single always-on web
 * process and no background workers, where the alternative is an outbox nobody drains and
 * an event pipeline that silently never fires. Same loop, same poll interval, same
 * idempotent `drainOutbox` — only the process it lives in differs.
 *
 * Never run both against one database. Each marks rows published; two publishers race.
 */
@Injectable()
export class OutboxPublisherService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('OutboxPublisher');
  private queue?: Queue;
  private connection?: IORedis;
  private timer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    if (process.env.RUN_OUTBOX_PUBLISHER !== '1') return;

    const pollMs = Number(process.env.OUTBOX_POLL_MS ?? 2000);
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
    this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue(EVENTS_QUEUE, {
      connection: this.connection as unknown as ConnectionOptions,
    });

    const enqueueToBus: OutboxHandler = async (envelope: EventEnvelope) => {
      await this.queue!.add(envelope.name, envelope, {
        ...EVENT_JOB_OPTS,
        jobId: envelope.eventId,
      });
    };

    this.timer = setInterval(() => {
      void drainOutbox(this.prisma, 'outbox-publisher', enqueueToBus).catch((e) =>
        this.logger.error(`drain failed: ${e instanceof Error ? e.message : String(e)}`),
      );
    }, pollMs);

    this.logger.warn(
      `in-process outbox publisher enabled (RUN_OUTBOX_PUBLISHER=1); polling every ${pollMs}ms. ` +
        'Do not also run the standalone worker against this database.',
    );
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.queue?.close();
    if (this.connection) await this.connection.quit();
  }
}
