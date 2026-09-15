import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { NotificationAudience } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import type { Db } from '../audit/audit.service';

export interface DispatchTarget {
  readonly audience: NotificationAudience;
  readonly recipientId: string;
  readonly body: string;
  readonly channel?: string;
}

/**
 * Notification dispatch. Persists one row per recipient. Fan-out on an exception (a
 * delay, a quality failure) reaches every affected party in their own role — the
 * conformance suite (CF-023) checks the fan-out reaches five distinct recipients, each
 * with a role-appropriate message, so `dispatchMany` writes them as independent rows.
 *
 * Actual delivery (WhatsApp / SMS / web push) is a later sprint; this is the durable
 * record and the in-app inbox. Delivery channel is stored per row so it can be routed
 * later without a schema change.
 */
@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async dispatch(subjectRef: string, target: DispatchTarget, db: Db = this.prisma) {
    return db.notification.create({
      data: {
        ref: `NTF-${randomUUID().slice(0, 8)}`,
        audience: target.audience,
        recipientId: target.recipientId,
        subjectRef,
        body: target.body,
        channel: target.channel ?? 'in_app',
      },
    });
  }

  async dispatchMany(subjectRef: string, targets: readonly DispatchTarget[], db: Db = this.prisma) {
    const out = [];
    for (const t of targets) {
      out.push(await this.dispatch(subjectRef, t, db));
    }
    return out;
  }

  async markRead(ref: string) {
    return this.prisma.notification.update({ where: { ref }, data: { readAt: new Date() } });
  }
}
