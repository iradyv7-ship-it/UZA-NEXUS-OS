import { Injectable, NotFoundException } from '@nestjs/common';
import type { Actor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { CommandAccessService } from '../command-authz.service';
import { departmentRef } from '../command-ids';

export interface CreateDepartmentInput {
  readonly code: string;
  readonly name: string;
}

export interface UpsertEmployeeProfileInput {
  readonly userId: string;
  readonly departmentCode?: string;
  readonly managerId?: string;
  readonly title?: string;
}

/**
 * Departments + the light org graph. A `Department` is name + a unique short code; an
 * `EmployeeProfile` links an internal user (their readable ref / `Actor.userId`) to a
 * department and an optional manager. Writes are org-admin (`ceo`/`venture_manager`); reads
 * are open to any internal role (`org:read`) so managers can see their structure.
 */
@Injectable()
export class DepartmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommandAccessService,
  ) {}

  async create(actor: Actor, input: CreateDepartmentInput) {
    const ref = departmentRef(input.code);
    await this.access.assertRole(actor, 'org:write', 'department', 'create', ref);
    const created = await this.prisma.department.create({
      data: { ref, code: input.code.toUpperCase(), name: input.name },
    });
    await this.access.allow(actor, 'department', 'create', ref);
    return created;
  }

  /** All departments with their members. Org-wide visibility for any internal role. */
  async list(actor: Actor) {
    await this.access.assertRole(actor, 'org:read', 'department', 'read');
    const rows = await this.prisma.department.findMany({
      orderBy: { code: 'asc' },
      include: { members: { orderBy: { userId: 'asc' } } },
    });
    await this.access.allow(actor, 'department', 'read');
    return rows;
  }

  async read(actor: Actor, ref: string) {
    await this.access.assertRole(actor, 'org:read', 'department', 'read', ref);
    const dept = await this.prisma.department.findUnique({
      where: { ref },
      include: { members: { orderBy: { userId: 'asc' } } },
    });
    if (!dept) throw new NotFoundException(`department ${ref} not found`);
    await this.access.allow(actor, 'department', 'read', ref);
    return dept;
  }

  /**
   * Assign (or re-assign) an internal user to a department + optional manager + title.
   * Idempotent on `userId` (one profile per user): re-running updates in place. The
   * department is resolved by its short code so callers/seeds do not carry the surrogate id.
   */
  async upsertEmployeeProfile(actor: Actor, input: UpsertEmployeeProfileInput) {
    await this.access.assertRole(actor, 'org:write', 'employeeProfile', 'update', input.userId);

    let departmentId: string | null = null;
    if (input.departmentCode) {
      const dept = await this.prisma.department.findUnique({
        where: { code: input.departmentCode.toUpperCase() },
        select: { id: true },
      });
      if (!dept) throw new NotFoundException(`department code ${input.departmentCode} not found`);
      departmentId = dept.id;
    }

    const profile = await this.prisma.employeeProfile.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        departmentId,
        managerId: input.managerId ?? null,
        title: input.title ?? null,
      },
      update: {
        departmentId,
        managerId: input.managerId ?? null,
        title: input.title ?? null,
      },
    });
    await this.access.allow(actor, 'employeeProfile', 'update', input.userId);
    return profile;
  }
}
