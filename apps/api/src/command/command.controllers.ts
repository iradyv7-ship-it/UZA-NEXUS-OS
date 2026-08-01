import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsArray, IsBooleanString, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { Actor, Minor } from '@uza/contracts';
import { CurrentActor } from '../platform/auth/current-actor.decorator';
import { TaskService } from './task/task.service';
import { GrantService } from './grant/grant.service';
import { DepartmentService } from './department/department.service';
import { OverviewService } from './overview/overview.service';

const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
const TASK_STATUS = ['todo', 'in_progress', 'blocked', 'done', 'cancelled'] as const;
const GRANT_STATUS = ['identified', 'preparing', 'submitted', 'awarded', 'rejected', 'closed'] as const;

// ---------- DTOs ----------
class CreateTaskDto {
  @IsString() @MinLength(1) title!: string;
  @IsOptional() @IsString() description?: string;
  @IsString() assigneeId!: string;
  @IsOptional() @IsString() departmentCode?: string;
  @IsOptional() @IsIn(PRIORITIES) priority?: (typeof PRIORITIES)[number];
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsString() linkedRef?: string;
  @IsOptional() @IsString() parentTaskRef?: string;
}
class UpdateTaskDto {
  @IsOptional() @IsIn(TASK_STATUS) status?: (typeof TASK_STATUS)[number];
  @IsOptional() @IsIn(PRIORITIES) priority?: (typeof PRIORITIES)[number];
  @IsOptional() @IsString() assigneeId?: string;
  @IsOptional() @IsDateString() dueAt?: string;
}
class ListTaskQuery {
  @IsOptional() @IsIn(TASK_STATUS) status?: (typeof TASK_STATUS)[number];
  @IsOptional() @IsString() assigneeId?: string;
  @IsOptional() @IsString() departmentCode?: string;
  @IsOptional() @IsBooleanString() overdue?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;
}

class RequirementDto { @IsString() item!: string; done!: boolean; }
class CreateGrantDto {
  @IsString() @MinLength(1) name!: string;
  @IsString() funder!: string;
  @Type(() => Number) @IsInt() @Min(0) amountMinor!: number;
  @IsString() currency!: string;
  @IsOptional() @IsDateString() deadlineAt?: string;
  @IsOptional() @IsString() fitNotes?: string;
  @IsOptional() @IsString() nextAction?: string;
  @IsOptional() @IsString() ownerId?: string;
  @IsOptional() @IsArray() requirements?: RequirementDto[];
}
class UpdateGrantDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() funder?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) amountMinor?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsDateString() deadlineAt?: string;
  @IsOptional() @IsString() fitNotes?: string;
  @IsOptional() @IsString() nextAction?: string;
  @IsOptional() @IsString() ownerId?: string;
  @IsOptional() @IsArray() requirements?: RequirementDto[];
}
class AdvanceGrantDto { @IsIn(GRANT_STATUS) to!: (typeof GRANT_STATUS)[number]; }
class ListGrantQuery {
  @IsOptional() @IsIn(GRANT_STATUS) status?: (typeof GRANT_STATUS)[number];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;
}
class CreateDepartmentDto {
  @IsString() @MinLength(1) code!: string;
  @IsString() @MinLength(1) name!: string;
}
class EmployeeProfileDto {
  @IsString() userId!: string;
  @IsOptional() @IsString() departmentCode?: string;
  @IsOptional() @IsString() managerId?: string;
  @IsOptional() @IsString() title?: string;
}
class OverviewQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(120) horizonDays?: number;
}

const page = (q: { limit?: number; offset?: number }) => ({ limit: q.limit ?? 20, offset: q.offset ?? 0 });

// ---------- controllers ----------
@ApiTags('command')
@ApiBearerAuth()
@Controller('command/tasks')
export class CommandTaskController {
  constructor(private readonly tasks: TaskService) {}

  @Post()
  create(@CurrentActor() actor: Actor, @Body() dto: CreateTaskDto) {
    return this.tasks.create(actor, { ...dto, dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined });
  }
  @Get()
  list(@CurrentActor() actor: Actor, @Query() q: ListTaskQuery) {
    return this.tasks.list(
      actor,
      { status: q.status, assigneeId: q.assigneeId, departmentCode: q.departmentCode, overdue: q.overdue === 'true' },
      page(q),
    );
  }
  @Get(':ref')
  read(@CurrentActor() actor: Actor, @Param('ref') ref: string) { return this.tasks.read(actor, ref); }
  @Patch(':ref')
  update(@CurrentActor() actor: Actor, @Param('ref') ref: string, @Body() dto: UpdateTaskDto) {
    return this.tasks.update(actor, ref, { ...dto, dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined });
  }
  @Post(':ref/complete')
  complete(@CurrentActor() actor: Actor, @Param('ref') ref: string) { return this.tasks.complete(actor, ref); }
  @Post(':ref/cancel')
  cancel(@CurrentActor() actor: Actor, @Param('ref') ref: string) { return this.tasks.cancel(actor, ref); }
  @Delete(':ref')
  remove(@CurrentActor() actor: Actor, @Param('ref') ref: string) { return this.tasks.delete(actor, ref); }
}

@ApiTags('command')
@ApiBearerAuth()
@Controller('command/grants')
export class CommandGrantController {
  constructor(private readonly grants: GrantService) {}

  @Post()
  create(@CurrentActor() actor: Actor, @Body() dto: CreateGrantDto) {
    return this.grants.create(actor, {
      ...dto, amountMinor: dto.amountMinor as Minor, deadlineAt: dto.deadlineAt ? new Date(dto.deadlineAt) : undefined,
    });
  }
  @Get()
  list(@CurrentActor() actor: Actor, @Query() q: ListGrantQuery) {
    return this.grants.list(actor, { status: q.status }, page(q));
  }
  @Get(':ref')
  read(@CurrentActor() actor: Actor, @Param('ref') ref: string) { return this.grants.read(actor, ref); }
  @Patch(':ref')
  update(@CurrentActor() actor: Actor, @Param('ref') ref: string, @Body() dto: UpdateGrantDto) {
    return this.grants.update(actor, ref, {
      ...dto,
      amountMinor: dto.amountMinor === undefined ? undefined : (dto.amountMinor as Minor),
      deadlineAt: dto.deadlineAt ? new Date(dto.deadlineAt) : undefined,
    });
  }
  @Post(':ref/advance')
  advance(@CurrentActor() actor: Actor, @Param('ref') ref: string, @Body() dto: AdvanceGrantDto) {
    return this.grants.advanceStatus(actor, ref, dto.to);
  }
}

@ApiTags('command')
@ApiBearerAuth()
@Controller('command')
export class CommandOrgController {
  constructor(
    private readonly departments: DepartmentService,
    private readonly overview: OverviewService,
  ) {}

  @Post('departments')
  createDept(@CurrentActor() actor: Actor, @Body() dto: CreateDepartmentDto) {
    return this.departments.create(actor, dto);
  }
  @Get('departments')
  listDepts(@CurrentActor() actor: Actor) { return this.departments.list(actor); }
  @Get('departments/:ref')
  readDept(@CurrentActor() actor: Actor, @Param('ref') ref: string) { return this.departments.read(actor, ref); }
  @Post('employee-profiles')
  upsertProfile(@CurrentActor() actor: Actor, @Body() dto: EmployeeProfileDto) {
    return this.departments.upsertEmployeeProfile(actor, dto);
  }
  @Get('overview')
  getOverview(@CurrentActor() actor: Actor, @Query() q: OverviewQuery) {
    return this.overview.overview(actor, { horizonDays: q.horizonDays });
  }
}
