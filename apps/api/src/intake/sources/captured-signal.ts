import type { SignalSource } from '@prisma/client';

/**
 * What a source hands back. Sources capture and normalise; they do not classify, redact,
 * store, or decide anything. That separation is what lets a new source be added without
 * touching the compartmentalisation rules — which is the part that must not be got wrong
 * twice.
 */
export interface CapturedSignal {
  readonly source: SignalSource;
  /** The source's own identifier. Must be stable across sweeps, or nothing is idempotent. */
  readonly externalId: string;
  readonly title: string;
  readonly body: string;
  /** When it happened at the source, not when it was swept. */
  readonly occurredAt: Date;
}
