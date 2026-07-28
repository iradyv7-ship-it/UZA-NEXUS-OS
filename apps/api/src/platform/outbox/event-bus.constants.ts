/**
 * Shared transport constants for the outbox → BullMQ event bus. Kept NestJS-free and
 * re-exported from `outbox-public.ts` so the publisher (apps/worker, running under tsx)
 * and the consumer (apps/api, running under SWC) agree on the queue name and job options
 * without either importing the other's framework surface.
 */
import type { JobsOptions } from 'bullmq';

/** The single fan-out queue every committed outbox event is published to. */
export const EVENTS_QUEUE = 'uza.events';

/**
 * Job options applied when the publisher enqueues an outbox event.
 *
 * - `jobId` is set per-job to the envelope's `eventId` (BullMQ de-dupes by jobId as a
 *   first line of defence; the ProcessedEvent guard is the durable one).
 * - `attempts` + exponential `backoff` implement the ordering/failure policy: a consumer
 *   whose referenced aggregate is not present yet (an out-of-order delivery) or whose
 *   handler throws fails the job, and BullMQ retries with growing delay so the upstream
 *   event can land in the meantime.
 * - `removeOnFail: false` keeps an exhausted job in the failed set as a durable
 *   dead-letter for inspection — a failure is never silently dropped.
 */
export const EVENT_JOB_OPTS: JobsOptions = {
  removeOnComplete: true,
  removeOnFail: false,
  attempts: 5,
  backoff: { type: 'exponential', delay: 2000 },
};
