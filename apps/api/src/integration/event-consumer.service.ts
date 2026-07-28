import { Injectable, Logger, type OnModuleInit, type OnApplicationShutdown } from '@nestjs/common';
import { Worker, type ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';
import type { EventEnvelope } from '@uza/contracts';
import { EVENTS_QUEUE } from '../platform/outbox/event-bus.constants';
import { EventDispatchService } from './event-dispatch.service';

/**
 * The BullMQ consumer that turns published outbox jobs into module fan-out.
 *
 * WHY IT RUNS HERE (apps/api), not in apps/worker: fan-out invokes NestJS-managed feature
 * services (OrderService, InvoiceService, …) whose constructor injection depends on
 * `emitDecoratorMetadata`. apps/api runs under SWC, which emits that metadata; apps/worker
 * runs under tsx (esbuild), which does NOT — under tsx the DI container yields `undefined`
 * constructor args (documented in docs/handoff/platform.md). So the consumer lives where
 * the container and the services live. apps/worker keeps the PUBLISHER role only (drain the
 * outbox → enqueue), which needs nothing but the NestJS-free `@uza/api` surface.
 *
 * Retries/backoff and dead-lettering come from the job options set at enqueue time
 * (EVENT_JOB_OPTS); the worker here just fails the job by letting `dispatch` throw.
 *
 * Set DISABLE_EVENT_CONSUMER=1 to skip starting it (e.g. a Redis-less environment).
 */
@Injectable()
export class EventConsumerService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('EventConsumer');
  private worker?: Worker;
  private connection?: IORedis;

  constructor(private readonly dispatcher: EventDispatchService) {}

  onModuleInit(): void {
    if (process.env.DISABLE_EVENT_CONSUMER === '1') {
      this.logger.warn('event consumer disabled (DISABLE_EVENT_CONSUMER=1); fan-out will not run');
      return;
    }

    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
    this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

    this.worker = new Worker(
      EVENTS_QUEUE,
      async (job) => {
        await this.dispatcher.dispatch(job.data as EventEnvelope);
      },
      { connection: this.connection as unknown as ConnectionOptions },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`job ${job?.id} (${job?.name}) failed attempt ${job?.attemptsMade}: ${err?.message}`);
    });

    this.logger.log(`consuming "${EVENTS_QUEUE}" for module fan-out`);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
    if (this.connection) await this.connection.quit();
  }
}
