import type { Prisma } from '@prisma/client';
import type { Actor } from '@uza/contracts';
import type { PrismaService } from '../prisma/prisma.service';
import { seesAllTasks, seesAllGrants } from './command-access';

/**
 * Command Center object-scope. Kept SEPARATE from the role gate (`command-access.ts`) and
 * mirrored between the by-ref read and the list, in the same discipline as
 * `trade/list-scope.ts`: a list must never surface a row the by-ref read would deny.
 *
 * TASK visibility, once the `task:read` role gate has passed:
 *  - `ceo` / `venture_manager` (hold `task:all`)      → every task.
 *  - a manager                                         → tasks in a department they manage,
 *                                                        PLUS their own (assignee/creator).
 *  - any other internal user                           → only their own (assignee/creator).
 *
 * "A department they manage" is data-derived, not a flag: the set of `departmentId`s across
 * the `EmployeeProfile` rows that name this actor as `managerId`. A user with no direct
 * reports manages no department and therefore sees only their own tasks — no special-casing.
 */

/** The distinct departments this actor manages (empty for a non-manager). */
export async function managedDepartmentIds(
  prisma: Pick<PrismaService, 'employeeProfile'>,
  actor: Actor,
): Promise<string[]> {
  const reports = await prisma.employeeProfile.findMany({
    where: { managerId: actor.userId, departmentId: { not: null } },
    select: { departmentId: true },
    distinct: ['departmentId'],
  });
  return reports.map((r) => r.departmentId).filter((id): id is string => id !== null);
}

/** Single-record task rule. `managedDeptIds` is pre-resolved so read/list agree exactly. */
export function canSeeTask(
  actor: Actor,
  task: { assigneeId: string; createdById: string; departmentId: string | null },
  managedDeptIds: readonly string[],
): boolean {
  if (seesAllTasks(actor.role)) return true;
  const own = task.assigneeId === actor.userId || task.createdById === actor.userId;
  const inManagedDept = task.departmentId !== null && managedDeptIds.includes(task.departmentId);
  return own || inManagedDept;
}

/**
 * The Prisma WHERE fragment selecting EXACTLY the tasks `canSeeTask` would admit — a
 * mechanical mirror, pinned by a unit test. Role grant is checked separately BEFORE this.
 */
export function taskScopeWhere(
  actor: Actor,
  managedDeptIds: readonly string[],
): Prisma.CommandTaskWhereInput {
  if (seesAllTasks(actor.role)) return {};
  return {
    OR: [
      { assigneeId: actor.userId },
      { createdById: actor.userId },
      ...(managedDeptIds.length > 0 ? [{ departmentId: { in: [...managedDeptIds] } }] : []),
    ],
  };
}

/**
 * GRANT visibility, once the `grant:read` role gate has passed:
 *  - `ceo` / `venture_manager` (hold `grant:all`) → every grant.
 *  - any other internal user                      → only grants they own (`ownerId`).
 */
export function canSeeGrant(actor: Actor, grant: { ownerId: string | null }): boolean {
  if (seesAllGrants(actor.role)) return true;
  return grant.ownerId !== null && grant.ownerId === actor.userId;
}

/** The Prisma WHERE mirror of `canSeeGrant`. */
export function grantScopeWhere(actor: Actor): Prisma.GrantWhereInput {
  if (seesAllGrants(actor.role)) return {};
  return { ownerId: actor.userId };
}
