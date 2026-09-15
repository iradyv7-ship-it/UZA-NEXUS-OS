import { Injectable } from '@nestjs/common';
import { Prisma, type AuditDecision, PrismaClient } from '@prisma/client';
import type { Actor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';

/** Anything that can run a Prisma write — the client itself or a transaction handle. */
export type Db = PrismaClient | Prisma.TransactionClient;

export interface AuditInput {
  readonly actorId: string;
  readonly actorRole: string;
  readonly resource: string;
  readonly action: string;
  readonly decision: AuditDecision;
  readonly reason?: string;
  readonly targetRef?: string;
  readonly detail?: Prisma.InputJsonValue;
}

/**
 * Append-only audit trail. This service exposes ONLY inserts. There is deliberately
 * no update or delete method — audit rows are immutable once written.
 *
 * `record` accepts an optional `db` handle so a caller may write inside an existing
 * transaction, but authorisation denials pass no handle: the denial must persist even
 * though the request is about to throw.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditInput, db: Db = this.prisma): Promise<{ id: string }> {
    const row = await db.auditLog.create({
      data: {
        actorId: input.actorId,
        actorRole: input.actorRole,
        resource: input.resource,
        action: input.action,
        decision: input.decision,
        reason: input.reason ?? null,
        targetRef: input.targetRef ?? null,
        detail: input.detail ?? Prisma.JsonNull,
      },
      select: { id: true },
    });
    return row;
  }

  allow(actor: Actor, resource: string, action: string, targetRef?: string, db?: Db) {
    return this.record(
      {
        actorId: actor.userId,
        actorRole: actor.role,
        resource,
        action,
        decision: 'allow',
        targetRef,
      },
      db,
    );
  }

  deny(
    actor: Actor,
    resource: string,
    action: string,
    reason: string,
    targetRef?: string,
    db?: Db,
  ) {
    return this.record(
      {
        actorId: actor.userId,
        actorRole: actor.role,
        resource,
        action,
        decision: 'deny',
        reason,
        targetRef,
      },
      db,
    );
  }
}
