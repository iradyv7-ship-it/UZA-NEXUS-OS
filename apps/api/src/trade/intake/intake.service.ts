import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Actor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../platform/authorization/authorization.service';
import { OutboxService } from '../../platform/outbox/outbox.service';
import { makeRef, VENTURE, currentYear } from '../trade-ids';

/**
 * The intake path. Badiane's real workflow starts with an informal WhatsApp message,
 * not a form — so a Lead captures raw, unstructured text verbatim. It is NOT yet a
 * structured request.
 *
 * `clarifyLead` is the human-confirmation gate: a person reviews the interpretation and
 * submits the confirmed structured `spec`, which is what produces the Request. Nothing
 * downstream (project, quotation, order) can exist until a human has confirmed the
 * interpretation this way — see ProjectService, which refuses an unclarified lead.
 */
@Injectable()
export class IntakeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
    private readonly outbox: OutboxService,
  ) {}

  /** Capture an informal enquiry (e.g. a WhatsApp message) as raw text. */
  async createLead(actor: Actor, input: { customerRef: string; rawText: string; agentId?: string }) {
    await this.authz.authorize(actor, 'lead', 'create');
    const customer = await this.prisma.customer.findUnique({ where: { ref: input.customerRef } });
    if (!customer) throw new NotFoundException(`customer ${input.customerRef} not found`);
    const agentId = input.agentId ?? actor.userId;

    return this.outbox.emit(actor.userId, async (tx, emit) => {
      const seq = (await tx.lead.count()) + 1;
      const ref = makeRef('lead', { year: currentYear(), seq });
      const lead = await tx.lead.create({
        data: { ref, customerRef: input.customerRef, agentId, rawText: input.rawText },
      });
      await emit('lead.created', { leadRef: ref, customerRef: input.customerRef, agentId });
      return lead;
    });
  }

  /**
   * Human confirmation of the interpretation → a structured Request. `spec` is the
   * confirmed structured reading of the raw text. Marks the lead clarified.
   */
  async clarifyLead(actor: Actor, input: { leadRef: string; spec: Record<string, unknown> }) {
    await this.authz.authorize(actor, 'request', 'create');
    const lead = await this.prisma.lead.findUnique({ where: { ref: input.leadRef } });
    if (!lead) throw new NotFoundException(`lead ${input.leadRef} not found`);
    if (lead.clarified) throw new BadRequestException(`lead ${input.leadRef} is already clarified`);

    return this.outbox.emit(actor.userId, async (tx, emit) => {
      const seq = (await tx.request.count()) + 1;
      const ref = makeRef('request', { venture: VENTURE, year: currentYear(), seq });
      const request = await tx.request.create({
        data: {
          ref,
          customerRef: lead.customerRef,
          leadRef: lead.ref,
          spec: input.spec as object,
        },
      });
      await tx.lead.update({
        where: { ref: lead.ref },
        data: { clarified: true, stage: 'Qualification' },
      });
      await emit('request.created', { requestRef: ref, customerRef: lead.customerRef });
      return request;
    });
  }
}
