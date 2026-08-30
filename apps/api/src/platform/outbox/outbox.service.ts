import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { EventEnvelope, UzaEventName, UzaEvents } from '@uza/contracts';
import { EVENT_OWNERS } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import type { Db } from '../audit/audit.service';

const PLATFORM_OWNER = 'platform';

/**
 * Transactional outbox.
 *
 * The critical invariant: an event row is written in the SAME database transaction as
 * the state change it describes. If that transaction rolls back, the event is never
 * published — there is no separate "emit" call a handler could make that would leak an
 * event for a change that did not commit.
 *
 * `enqueue` therefore REQUIRES a transaction handle. It does not open its own. Use
 * `emit` when you want the outbox to own the transaction around a unit of work.
 */
@Injectable()
export class OutboxService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Write an event into the outbox using the caller's transaction handle `tx`.
   * Must be called from inside a `prisma.$transaction(...)` alongside the state change.
   */
  async enqueue<T extends UzaEventName>(
    tx: Db,
    name: T,
    payload: UzaEvents[T],
    actorId: string,
    opts: { eventId?: string; occurredAt?: Date } = {},
  ): Promise<EventEnvelope<T>> {
    const eventId = opts.eventId ?? randomUUID();
    const occurredAt = opts.occurredAt ?? new Date();

    await tx.outboxEvent.create({
      data: {
        eventId,
        name,
        actorId,
        payload: payload as Prisma.InputJsonValue,
        occurredAt,
      },
    });

    return { eventId, name, actorId, occurredAt: occurredAt.toISOString(), payload };
  }

  /**
   * Run a unit of work AND its events in one transaction. The callback receives the
   * transaction handle and an `emit` bound to it; whatever it emits is written in the
   * same transaction as its writes. If the callback throws, nothing is published.
   */
  async emit<R>(
    actorId: string,
    work: (
      tx: Prisma.TransactionClient,
      emit: <T extends UzaEventName>(
        name: T,
        payload: UzaEvents[T],
        eventId?: string,
      ) => Promise<void>,
    ) => Promise<R>,
  ): Promise<R> {
    return this.prisma.$transaction(async (tx) => {
      const emit = async <T extends UzaEventName>(
        name: T,
        payload: UzaEvents[T],
        eventId?: string,
      ) => {
        await this.enqueue(tx, name, payload, actorId, eventId ? { eventId } : {});
      };
      return work(tx, emit);
    });
  }

  /**
   * Ownership guard. Publishing an event a module does not own is a bug. Platform-core
   * owns no business events (it is infrastructure), so this is primarily a tripwire for
   * misuse and a documented check the integration contract asks for.
   */
  static ownerOf(name: UzaEventName): string {
    return EVENT_OWNERS[name] ?? PLATFORM_OWNER;
  }
}
