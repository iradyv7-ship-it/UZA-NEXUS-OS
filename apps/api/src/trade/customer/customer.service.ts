import { Injectable, NotFoundException } from '@nestjs/common';
import type { Actor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../platform/authorization/authorization.service';
import { makeRef } from '../trade-ids';

export interface NewCustomer {
  readonly name: string;
  readonly country: string;
  readonly phone: string;
  readonly agentId?: string;
}

/**
 * Customers — the head of the commercial record chain. A sales agent owns the customers
 * they create (agentId defaults to the agent), which is what makes object-scope work:
 * a sales_agent may only reach records whose agentId is their own.
 */
@Injectable()
export class CustomerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
  ) {}

  async create(actor: Actor, input: NewCustomer) {
    await this.authz.authorize(actor, 'customer', 'create');
    const agentId = input.agentId ?? (actor.role === 'sales_agent' ? actor.userId : null);
    return this.prisma.$transaction(async (tx) => {
      const seq = (await tx.customer.count()) + 1;
      const ref = makeRef('customer', { country: input.country, seq });
      return tx.customer.create({
        data: {
          ref,
          name: input.name,
          country: input.country,
          phone: input.phone,
          agentId,
        },
      });
    });
  }

  async read(actor: Actor, ref: string) {
    const customer = await this.prisma.customer.findUnique({ where: { ref } });
    if (!customer) throw new NotFoundException(`customer ${ref} not found`);
    await this.authz.authorize(actor, 'customer', 'read', {
      customerId: customer.ref,
      agentId: customer.agentId ?? undefined,
    });
    return this.authz.mask(actor, { ...customer });
  }
}
