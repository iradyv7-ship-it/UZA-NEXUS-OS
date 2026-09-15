import { Injectable } from '@nestjs/common';
import type { Actor, Minor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../platform/authorization/authorization.service';
import { pettyCashRef } from '../finance-ids';

export type PettyCashKind = 'float' | 'expense' | 'replenishment';

export interface PettyCashMovement {
  readonly office: string;
  /** Signed minor units: a `float`/`replenishment` is positive, an `expense` is negative. */
  readonly amountMinor: Minor;
  readonly kind: PettyCashKind;
  readonly memo: string;
}

/**
 * Petty cash — a per-office cash tin kept as an APPEND-ONLY ledger, never a mutable
 * balance. The office balance is the signed sum of its rows. Authorised on `pettyCash:*`
 * (front office and ceo hold it), because the tin is a front-office instrument that
 * finance reconciles.
 */
@Injectable()
export class PettyCashService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
  ) {}

  async record(actor: Actor, input: PettyCashMovement) {
    await this.authz.authorize(actor, 'pettyCash', 'create');
    // An expense must be a negative movement; a float/replenishment a positive one. Sign
    // is derived from kind so a mis-signed amount cannot inflate a tin.
    const magnitude = Math.abs(input.amountMinor);
    const amountMinor = (input.kind === 'expense' ? -magnitude : magnitude) as Minor;
    return this.prisma.$transaction(async (tx) => {
      const seq = (await tx.pettyCashTransaction.count({ where: { office: input.office } })) + 1;
      return tx.pettyCashTransaction.create({
        data: {
          ref: pettyCashRef(input.office, seq),
          office: input.office,
          amountMinor,
          kind: input.kind,
          memo: input.memo,
          actorId: actor.userId,
        },
      });
    });
  }

  async balance(actor: Actor, office: string) {
    await this.authz.authorize(actor, 'pettyCash', 'read');
    const rows = await this.prisma.pettyCashTransaction.findMany({ where: { office } });
    const balanceMinor = rows.reduce((a, r) => a + r.amountMinor, 0) as Minor;
    return { office, balanceMinor, entries: rows.length };
  }
}
