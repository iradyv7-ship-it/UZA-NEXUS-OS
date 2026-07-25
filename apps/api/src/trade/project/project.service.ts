import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Actor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../platform/authorization/authorization.service';
import { makeRef, VENTURE, currentYear } from '../trade-ids';

/**
 * Projects and their RACI tasks. A project is the unit of delivery work, created from a
 * Request — but ONLY once the underlying Lead has been clarified by a human. Unstructured
 * WhatsApp text never becomes a project without that confirmation step.
 */
@Injectable()
export class ProjectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
  ) {}

  async create(actor: Actor, input: { requestRef: string; name: string; owner: string }) {
    await this.authz.authorize(actor, 'project', 'create');

    const request = await this.prisma.request.findUnique({ where: { ref: input.requestRef } });
    if (!request) throw new NotFoundException(`request ${input.requestRef} not found`);

    const lead = await this.prisma.lead.findUnique({ where: { ref: request.leadRef } });
    if (!lead?.clarified) {
      throw new BadRequestException(
        `request ${input.requestRef} cannot become a project: its lead is not clarified — ` +
          'a human must confirm the interpretation first',
      );
    }

    const customer = await this.prisma.customer.findUnique({ where: { ref: request.customerRef } });

    const seq = (await this.prisma.project.count()) + 1;
    const ref = makeRef('project', { venture: VENTURE, year: currentYear(), seq });
    return this.prisma.project.create({
      data: {
        ref,
        customerRef: request.customerRef,
        agentId: customer?.agentId ?? null,
        requestRef: request.ref,
        name: input.name,
        owner: input.owner,
      },
    });
  }

  /**
   * A RACI task. `accountable` (one owner who answers for the outcome) and `responsible`
   * (who does the work) are separate, mandatory fields — never collapsed into one
   * assignee. Independent responsibilities get independent fields.
   */
  async createTask(
    actor: Actor,
    input: { projectRef: string; title: string; accountable: string; responsible: string },
  ) {
    await this.authz.authorize(actor, 'task', 'create');
    if (!input.accountable || !input.responsible) {
      throw new BadRequestException('a task requires both an accountable and a responsible party (RACI)');
    }
    const project = await this.prisma.project.findUnique({ where: { ref: input.projectRef } });
    if (!project) throw new NotFoundException(`project ${input.projectRef} not found`);

    const seq = (await this.prisma.task.count()) + 1;
    const ref = makeRef('task', { venture: VENTURE, year: currentYear(), seq });
    return this.prisma.task.create({
      data: {
        ref,
        projectRef: input.projectRef,
        title: input.title,
        accountable: input.accountable,
        responsible: input.responsible,
      },
    });
  }
}
