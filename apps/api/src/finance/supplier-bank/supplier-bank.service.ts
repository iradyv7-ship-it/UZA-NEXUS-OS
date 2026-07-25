import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { UzaError, type Actor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../platform/authorization/authorization.service';
import { bankChangeRef } from '../finance-ids';

/** Two distinct approvals apply a change. Where supplier money goes is worth four eyes. */
const REQUIRED_APPROVALS = 2;

export interface BankDetails {
  readonly supplierRef: string;
  readonly accountName: string;
  readonly iban: string;
  readonly bankName: string;
}

/**
 * Supplier bank-detail changes under DUAL APPROVAL. Redirecting where a supplier is paid
 * is the classic payment-fraud vector, so a change never applies on one person's say-so:
 *
 *  - `requestChange` records a proposal (status pending_dual_approval).
 *  - `approve` records one approver's approval. The change APPLIES only after two DISTINCT
 *    finance approvers approve, and the requester may NOT self-approve. A person cannot
 *    approve twice (unique `(requestRef, approverId)`).
 *
 * Gated on `payment:approve` (finance + ceo only) at both ends — the same finance-only
 * permission that governs releasing money.
 */
@Injectable()
export class SupplierBankService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
  ) {}

  async requestChange(actor: Actor, input: BankDetails) {
    await this.authz.authorize(actor, 'payment', 'approve');
    return this.prisma.$transaction(async (tx) => {
      const seq = (await tx.supplierBankChangeRequest.count()) + 1;
      return tx.supplierBankChangeRequest.create({
        data: {
          ref: bankChangeRef(seq),
          supplierRef: input.supplierRef,
          accountName: input.accountName,
          iban: input.iban,
          bankName: input.bankName,
          requestedBy: actor.userId,
        },
      });
    });
  }

  /**
   * Record an approval. Applies the change on reaching the second distinct approval.
   * @throws UzaError when the requester tries to self-approve (four-eyes violation).
   */
  async approve(actor: Actor, requestRef: string) {
    await this.authz.authorize(actor, 'payment', 'approve');

    const request = await this.prisma.supplierBankChangeRequest.findUnique({
      where: { ref: requestRef },
      include: { approvals: true },
    });
    if (!request) throw new NotFoundException(`bank change ${requestRef} not found`);
    if (request.status !== 'pending_dual_approval') {
      throw new BadRequestException(`bank change ${requestRef} is already ${request.status}`);
    }
    // The requester cannot be one of the approvers — that is the whole point of four-eyes.
    if (actor.userId === request.requestedBy) {
      throw new UzaError({
        code: 'ACCESS_DENIED_ROLE',
        message: 'The requester of a bank-detail change cannot approve it.',
        responsibleRole: actor.role,
        context: { requestRef },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      // Unique (requestRef, approverId) makes a second approval by the same person a no-op
      // error rather than a counted vote.
      await tx.supplierBankChangeApproval.create({
        data: { requestRef, approverId: actor.userId },
      });

      const approvals = await tx.supplierBankChangeApproval.count({ where: { requestRef } });
      if (approvals < REQUIRED_APPROVALS) {
        return { status: 'pending_dual_approval' as const, requestRef, approvals };
      }

      // Second distinct approval — apply the change to the active account.
      await tx.supplierBankAccount.upsert({
        where: { supplierRef: request.supplierRef },
        create: {
          supplierRef: request.supplierRef,
          accountName: request.accountName,
          iban: request.iban,
          bankName: request.bankName,
          appliedByRequest: requestRef,
        },
        update: {
          accountName: request.accountName,
          iban: request.iban,
          bankName: request.bankName,
          appliedByRequest: requestRef,
        },
      });
      await tx.supplierBankChangeRequest.update({
        where: { ref: requestRef },
        data: { status: 'applied', appliedAt: new Date() },
      });
      return { status: 'applied' as const, requestRef, approvals };
    });
  }

  async readAccount(actor: Actor, supplierRef: string) {
    await this.authz.authorize(actor, 'supplier', 'read');
    return this.prisma.supplierBankAccount.findUnique({ where: { supplierRef } });
  }
}
