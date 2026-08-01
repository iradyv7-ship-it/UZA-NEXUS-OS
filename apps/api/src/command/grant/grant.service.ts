import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Prisma, type GrantStatus } from '@prisma/client';
import type { Actor, Minor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { CommandAccessService } from '../command-authz.service';
import { grantRef } from '../command-ids';
import { canSeeGrant, grantScopeWhere } from '../command-scope';

export interface RequirementItem {
  readonly item: string;
  readonly done: boolean;
}

export interface CreateGrantInput {
  readonly name: string;
  readonly funder: string;
  readonly amountMinor: Minor;
  readonly currency: string;
  readonly deadlineAt?: Date;
  readonly fitNotes?: string;
  readonly nextAction?: string;
  readonly ownerId?: string;
  readonly requirements?: readonly RequirementItem[];
}

export interface UpdateGrantInput {
  readonly name?: string;
  readonly funder?: string;
  readonly amountMinor?: Minor;
  readonly currency?: string;
  readonly deadlineAt?: Date | null;
  readonly fitNotes?: string;
  readonly nextAction?: string;
  readonly ownerId?: string | null;
  readonly requirements?: readonly RequirementItem[];
}

const RESOURCE = 'grant';

/**
 * Legal grant-pipeline transitions. A grant advances one hop along the funnel; awarded and
 * rejected are the two terminal-ish decisions that can then be `closed`. Enforced so a
 * status cannot skip a stage or move backwards silently.
 */
const GRANT_TRANSITIONS: Record<GrantStatus, readonly GrantStatus[]> = {
  identified: ['preparing'],
  preparing: ['submitted'],
  submitted: ['awarded', 'rejected'],
  awarded: ['closed'],
  rejected: ['closed'],
  closed: [],
};

/**
 * The grant pipeline with deadline awareness. `amountMinor` is integer minor units of
 * `currency`. Creation is org-admin (`ceo`/`venture_manager`); reads/writes are open to any
 * internal role via the module policy but object-scoped: a non-admin sees/updates ONLY the
 * grants they own (`ownerId`). The list mirrors the by-ref read (`grantScopeWhere`).
 */
@Injectable()
export class GrantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommandAccessService,
  ) {}

  async create(actor: Actor, input: CreateGrantInput) {
    await this.access.assertRole(actor, 'grant:create', RESOURCE, 'create');
    if (!Number.isInteger(input.amountMinor)) {
      throw new BadRequestException('amountMinor must be an integer (minor units)');
    }
    const seq = (await this.prisma.grant.count()) + 1;
    const ref = grantRef(seq);
    const created = await this.prisma.grant.create({
      data: {
        ref,
        name: input.name,
        funder: input.funder,
        amountMinor: input.amountMinor,
        currency: input.currency,
        deadlineAt: input.deadlineAt ?? null,
        status: 'identified',
        fitNotes: input.fitNotes ?? null,
        nextAction: input.nextAction ?? null,
        ownerId: input.ownerId ?? null,
        requirements: (input.requirements ?? []) as unknown as Prisma.InputJsonValue,
      },
    });
    await this.access.allow(actor, RESOURCE, 'create', ref);
    return created;
  }

  /** Grants in scope, optionally narrowed by status. Owner-scoped for non-admins. */
  async list(actor: Actor, filters: { status?: GrantStatus }, page: { limit: number; offset: number }) {
    await this.access.assertRole(actor, 'grant:read', RESOURCE, 'read');
    const and: Prisma.GrantWhereInput[] = [grantScopeWhere(actor)];
    if (filters.status) and.push({ status: filters.status });
    const rows = await this.prisma.grant.findMany({
      where: { AND: and },
      orderBy: [{ deadlineAt: 'asc' }, { updatedAt: 'desc' }],
      take: page.limit,
      skip: page.offset,
    });
    await this.access.allow(actor, RESOURCE, 'read');
    return rows;
  }

  async read(actor: Actor, ref: string) {
    await this.access.assertRole(actor, 'grant:read', RESOURCE, 'read', ref);
    const grant = await this.prisma.grant.findUnique({ where: { ref } });
    if (!grant) throw new NotFoundException(`grant ${ref} not found`);
    if (!canSeeGrant(actor, grant)) {
      return this.access.denyScope(actor, RESOURCE, 'read', ref);
    }
    await this.access.allow(actor, RESOURCE, 'read', ref);
    return grant;
  }

  private async loadWritable(actor: Actor, ref: string, action: string) {
    await this.access.assertRole(actor, 'grant:write', RESOURCE, action, ref);
    const grant = await this.prisma.grant.findUnique({ where: { ref } });
    if (!grant) throw new NotFoundException(`grant ${ref} not found`);
    if (!canSeeGrant(actor, grant)) {
      await this.access.denyScope(actor, RESOURCE, action, ref);
    }
    return grant;
  }

  async update(actor: Actor, ref: string, input: UpdateGrantInput) {
    await this.loadWritable(actor, ref, 'update');
    if (input.amountMinor !== undefined && !Number.isInteger(input.amountMinor)) {
      throw new BadRequestException('amountMinor must be an integer (minor units)');
    }
    const data: Prisma.GrantUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.funder !== undefined) data.funder = input.funder;
    if (input.amountMinor !== undefined) data.amountMinor = input.amountMinor;
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.deadlineAt !== undefined) data.deadlineAt = input.deadlineAt;
    if (input.fitNotes !== undefined) data.fitNotes = input.fitNotes;
    if (input.nextAction !== undefined) data.nextAction = input.nextAction;
    if (input.ownerId !== undefined) data.ownerId = input.ownerId;
    if (input.requirements !== undefined) {
      data.requirements = input.requirements as unknown as Prisma.InputJsonValue;
    }
    const updated = await this.prisma.grant.update({ where: { ref }, data });
    await this.access.allow(actor, RESOURCE, 'update', ref);
    return updated;
  }

  /** Advance the grant one legal hop along the funnel. Illegal transitions → 409. */
  async advanceStatus(actor: Actor, ref: string, to: GrantStatus) {
    const grant = await this.loadWritable(actor, ref, 'advance');
    const allowed = GRANT_TRANSITIONS[grant.status];
    if (!allowed.includes(to)) {
      throw new ConflictException(
        `grant ${ref} cannot move from ${grant.status} to ${to} ` +
          `(allowed: ${allowed.length ? allowed.join(', ') : 'none — terminal'})`,
      );
    }
    const updated = await this.prisma.grant.update({ where: { ref }, data: { status: to } });
    await this.access.allow(actor, RESOURCE, 'advance', ref);
    return updated;
  }
}
