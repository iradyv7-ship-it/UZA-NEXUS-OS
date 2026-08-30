import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { MemoAudience } from '@prisma/client';
import type { Actor } from '@uza/contracts';
import { nextSequence, refPrefix } from '../planning-ids';
import { PrismaService } from '../../prisma/prisma.service';
import { PlanningAccessService } from '../planning-authz.service';

const RESOURCE = 'memo';

export interface SendMemoInput {
  readonly subject: string;
  readonly body: string;
  readonly audience: MemoAudience;
  readonly departmentCode?: string;
  readonly toId?: string;
  readonly ventureCode?: string;
  readonly needsAck?: boolean;
  readonly linkedRef?: string;
}

/**
 * Memos — reaching people, with proof.
 *
 * This is not chat and must not become chat. Chat is for conversation and the team already
 * has somewhere for that; adding a second place to talk would only split the conversation
 * in half. A memo is for the one thing chat is worst at: something that must reach named
 * people and be known to have reached them.
 *
 * The receipts are the entire point. "I told everyone" is not a fact until you can say who
 * opened it, and for anything that changes how a person works — a new threshold, a new
 * rule, a deadline — reading is not enough, so `needsAck` forces a second, deliberate act.
 *
 * Recipients are resolved and written at send time rather than computed on read. Someone
 * who joins next week should not silently appear as an unread recipient of a memo sent
 * before they arrived, and someone who leaves should not erase the fact that they read it.
 */
@Injectable()
export class MemoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: PlanningAccessService,
  ) {}

  private async resolveRecipients(input: SendMemoInput, senderRef: string): Promise<string[]> {
    if (input.audience === 'person') {
      if (!input.toId) throw new BadRequestException('a memo to one person needs toId');
      return [input.toId];
    }
    if (input.audience === 'department') {
      if (!input.departmentCode)
        throw new BadRequestException('a memo to a department needs departmentCode');
      const dept = await this.prisma.department.findUnique({
        where: { code: input.departmentCode.toUpperCase() },
        select: { id: true },
      });
      if (!dept) throw new NotFoundException(`department ${input.departmentCode} not found`);
      const members = await this.prisma.employeeProfile.findMany({
        where: { departmentId: dept.id },
        select: { userId: true },
      });
      return members.map((m) => m.userId).filter((u) => u !== senderRef);
    }
    const everyone = await this.prisma.employeeProfile.findMany({ select: { userId: true } });
    // The sender is excluded: an unread count that includes your own announcements is noise.
    return everyone.map((e) => e.userId).filter((u) => u !== senderRef);
  }

  async send(actor: Actor, input: SendMemoInput) {
    // `review` is the ceo/venture_manager capability. Broadcasting to the company is an
    // act of authority, not a convenience — anyone can raise a decision instead.
    await this.access.assertRole(actor, 'review', RESOURCE, 'send');
    if (!input.subject.trim()) throw new BadRequestException('a memo needs a subject');
    if (!input.body.trim()) throw new BadRequestException('a memo needs a body');

    const recipients = await this.resolveRecipients(input, actor.userId);
    if (!recipients.length) throw new BadRequestException('that audience resolves to nobody');

    const seq = await nextSequence(this.prisma.memo, refPrefix('MEMO'));
    const ref = `MEMO-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`;

    const created = await this.prisma.memo.create({
      data: {
        ref,
        subject: input.subject.trim(),
        body: input.body.trim(),
        fromId: actor.userId,
        audience: input.audience,
        departmentCode: input.departmentCode?.toUpperCase() ?? null,
        toId: input.toId ?? null,
        ventureCode: input.ventureCode ?? null,
        needsAck: input.needsAck ?? false,
        linkedRef: input.linkedRef ?? null,
        receipts: { create: recipients.map((userRef) => ({ userRef })) },
      },
      include: { receipts: true },
    });
    await this.access.allow(actor, RESOURCE, 'send', ref);
    return { ...created, sentTo: recipients.length };
  }

  /** One person's inbox. Unread and unacknowledged first — those are the ones that matter. */
  async inbox(actor: Actor) {
    await this.access.assertRole(actor, 'plan:read', RESOURCE, 'inbox');
    const receipts = await this.prisma.memoReceipt.findMany({
      where: { userRef: actor.userId },
      include: { memo: true },
      orderBy: { memo: { sentAt: 'desc' } },
      take: 50,
    });
    await this.access.allow(actor, RESOURCE, 'inbox');
    const rows = receipts.map((r) => ({
      ref: r.memo.ref,
      subject: r.memo.subject,
      body: r.memo.body,
      fromId: r.memo.fromId,
      needsAck: r.memo.needsAck,
      linkedRef: r.memo.linkedRef,
      sentAt: r.memo.sentAt,
      readAt: r.readAt,
      ackedAt: r.ackedAt,
      /** What this person still has to do about it, if anything. */
      outstanding: r.memo.needsAck ? !r.ackedAt : !r.readAt,
    }));
    return { unread: rows.filter((r) => r.outstanding).length, memos: rows };
  }

  /** Opening it. Idempotent — the first read is the one recorded. */
  async markRead(actor: Actor, ref: string) {
    await this.access.assertRole(actor, 'plan:read', RESOURCE, 'read', ref);
    const receipt = await this.prisma.memoReceipt.findUnique({
      where: { memoRef_userRef: { memoRef: ref, userRef: actor.userId } },
    });
    if (!receipt) throw new NotFoundException(`memo ${ref} was not sent to you`);
    if (receipt.readAt) return receipt;
    return this.prisma.memoReceipt.update({
      where: { id: receipt.id },
      data: { readAt: new Date() },
    });
  }

  /** Acknowledging it. A second, deliberate act — reading is not agreeing to do something. */
  async acknowledge(actor: Actor, ref: string) {
    await this.access.assertRole(actor, 'plan:read', RESOURCE, 'ack', ref);
    const receipt = await this.prisma.memoReceipt.findUnique({
      where: { memoRef_userRef: { memoRef: ref, userRef: actor.userId } },
    });
    if (!receipt) throw new NotFoundException(`memo ${ref} was not sent to you`);
    const now = new Date();
    const updated = await this.prisma.memoReceipt.update({
      where: { id: receipt.id },
      data: { ackedAt: receipt.ackedAt ?? now, readAt: receipt.readAt ?? now },
    });
    await this.access.allow(actor, RESOURCE, 'ack', ref);
    return updated;
  }

  /** Who has read it and who has not. The half of "I told everyone" that is checkable. */
  async receipts(actor: Actor, ref: string) {
    await this.access.assertRole(actor, 'review', RESOURCE, 'receipts', ref);
    const memo = await this.prisma.memo.findUnique({
      where: { ref },
      include: { receipts: { orderBy: { userRef: 'asc' } } },
    });
    if (!memo) throw new NotFoundException(`memo ${ref} not found`);
    await this.access.allow(actor, RESOURCE, 'receipts', ref);
    return {
      ref: memo.ref,
      subject: memo.subject,
      needsAck: memo.needsAck,
      sentTo: memo.receipts.length,
      read: memo.receipts.filter((r) => r.readAt).length,
      acknowledged: memo.receipts.filter((r) => r.ackedAt).length,
      outstanding: memo.receipts
        .filter((r) => (memo.needsAck ? !r.ackedAt : !r.readAt))
        .map((r) => r.userRef),
    };
  }

  /** Everything sent, with its receipt counts. The sender's view. */
  async sent(actor: Actor) {
    await this.access.assertRole(actor, 'review', RESOURCE, 'sent');
    const memos = await this.prisma.memo.findMany({
      orderBy: { sentAt: 'desc' },
      take: 30,
      include: { receipts: true },
    });
    await this.access.allow(actor, RESOURCE, 'sent');
    return memos.map((m) => ({
      ref: m.ref,
      subject: m.subject,
      fromId: m.fromId,
      audience: m.audience,
      needsAck: m.needsAck,
      sentAt: m.sentAt,
      sentTo: m.receipts.length,
      read: m.receipts.filter((r) => r.readAt).length,
      acknowledged: m.receipts.filter((r) => r.ackedAt).length,
    }));
  }
}
