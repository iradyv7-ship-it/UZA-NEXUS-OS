import { Module } from '@nestjs/common';
import { AuditService } from '../platform/audit/audit.service';
import { CommandAccessService } from './command-authz.service';
import { TaskService } from './task/task.service';
import { GrantService } from './grant/grant.service';
import { DepartmentService } from './department/department.service';
import { OverviewService } from './overview/overview.service';
import { CommandTaskController, CommandGrantController, CommandOrgController } from './command.controllers';

/**
 * Nexas Command Center — the executive-layer management brain (v1): cross-department tasks,
 * the grants pipeline, a light org/department graph, and the CEO overview. Authorisation is
 * the module-local `COMMAND_ACCESS` policy enforced at the service layer, audited into the
 * SAME append-only platform audit log via `AuditService`. PrismaService is global.
 * The CTO wires this into AppModule at integration; tests instantiate the services directly.
 */
@Module({
  providers: [AuditService, CommandAccessService, TaskService, GrantService, DepartmentService, OverviewService],
  controllers: [CommandTaskController, CommandGrantController, CommandOrgController],
  exports: [TaskService, GrantService, DepartmentService, OverviewService],
})
export class CommandModule {}
