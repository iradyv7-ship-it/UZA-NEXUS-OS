import { nextSequence } from '../../platform/ids/next-sequence';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Actor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../platform/authorization/authorization.service';
import { makeRef, VENTURE, currentYear } from '../trade-ids';
import { tradeScopeWhere } from '../list-scope';

export interface ListPage {
  readonly limit: number;
  readonly offset: number;
}

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

    const seq = await nextSequence(this.prisma.project, (n) =>
      makeRef('project', { venture: VENTURE, year: currentYear(), seq: n }),
    );
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
   * Single project read (name / owner / stage). Same object-scope as every by-ref read:
   * authorize with the record's `{ customerId, agentId }` so a caller out of scope is
   * denied 403 (ACCESS_DENIED_SCOPE). Projects carry no CONFIDENTIAL_FIELDS, so `mask` is
   * a no-op here — applied anyway to keep every read path uniform.
   */
  async read(actor: Actor, ref: string) {
    const project = await this.prisma.project.findUnique({ where: { ref } });
    if (!project) throw new NotFoundException(`project ${ref} not found`);
    await this.authz.authorize(actor, 'project', 'read', {
      customerId: project.customerRef,
      agentId: project.agentId ?? undefined,
    });
    return this.authz.mask(actor, { ...project });
  }

  /**
   * The caller's in-scope projects. Role grant is checked first (no object → 403 if the
   * role cannot read projects at all); object-scope is then applied as a WHERE predicate
   * via `tradeScopeWhere`, which mirrors `inScope` exactly so the list can never surface a
   * record the by-ref read would deny. Optional `customerRef`/`stage` filters AND on top of
   * scope (a filter can only narrow, never widen, the in-scope set). Stable sort:
   * most-recently-updated first.
   */
  async list(actor: Actor, filters: { customerRef?: string; stage?: string }, page: ListPage) {
    await this.authz.authorize(actor, 'project', 'read');
    const where: Prisma.ProjectWhereInput = {
      AND: [
        tradeScopeWhere(actor),
        ...(filters.customerRef ? [{ customerRef: filters.customerRef }] : []),
        ...(filters.stage ? [{ stage: filters.stage }] : []),
      ],
    };
    const rows = await this.prisma.project.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: page.limit,
      skip: page.offset,
    });
    return rows.map((row) => this.authz.mask(actor, { ...row }));
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
      throw new BadRequestException(
        'a task requires both an accountable and a responsible party (RACI)',
      );
    }
    const project = await this.prisma.project.findUnique({ where: { ref: input.projectRef } });
    if (!project) throw new NotFoundException(`project ${input.projectRef} not found`);

    const seq = await nextSequence(this.prisma.task, (n) =>
      makeRef('task', { venture: VENTURE, year: currentYear(), seq: n }),
    );
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
