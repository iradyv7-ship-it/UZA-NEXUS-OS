import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import type { Actor } from '@uza/contracts';
import { CurrentActor } from '../auth/current-actor.decorator';
import { IdentityService } from './identity.service';
import type { RoleName } from '@prisma/client';

// 'customer' deliberately excluded — see packages/contracts/src/permissions.ts. No account
// with this role can be created through Nexus; customer-facing access belongs on uzabulk.com.
const ROLES = [
  'ceo',
  'venture_manager',
  'china_sourcing',
  'china_warehouse',
  'front_office',
  'finance',
  'sales_agent',
  'logistics_partner',
] as const;

class CreateOrgDto {
  @IsString() @MinLength(1) name!: string;
}
class CreateOfficeDto {
  @IsString() organisationId!: string;
  @IsString() code!: string;
  @IsString() name!: string;
}
class CreateUserDto {
  @IsString() ref!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsIn(ROLES) role!: RoleName;
  @IsString() officeId!: string;
  @IsOptional() @IsString() scopeCustomerId?: string;
}
class CreatePartnerDto extends CreateUserDto {
  @IsDateString() expiresAt!: string;
}
class AssignRoleDto {
  @IsIn(ROLES) role!: RoleName;
  @IsOptional() @IsString() reason?: string;
}

/**
 * Administrative identity endpoints. Behind the global JWT guard (authenticated) AND
 * authorised in IdentityService: every method calls `authorize(actor, ...)`, which only the
 * `ceo` grant (`*:*`) satisfies today — so a non-admin principal is denied (403) at the
 * service layer, the single enforcement point. The assigner of a role is the authenticated
 * actor, never a caller-supplied id.
 */
@ApiTags('identity')
@ApiBearerAuth()
@Controller('identity')
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Post('organisations')
  createOrg(@CurrentActor() actor: Actor, @Body() dto: CreateOrgDto) {
    return this.identity.createOrganisation(actor, dto.name);
  }

  @Post('offices')
  createOffice(@CurrentActor() actor: Actor, @Body() dto: CreateOfficeDto) {
    return this.identity.createOffice(actor, dto.organisationId, dto.code, dto.name);
  }

  @Post('employees')
  createEmployee(@CurrentActor() actor: Actor, @Body() dto: CreateUserDto) {
    return this.identity.createEmployee(actor, dto);
  }

  @Post('partners')
  createPartner(@CurrentActor() actor: Actor, @Body() dto: CreatePartnerDto) {
    return this.identity.createPartnerAccount(actor, dto, new Date(dto.expiresAt));
  }

  @Post('users/:id/roles')
  assignRole(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() dto: AssignRoleDto) {
    return this.identity.assignRole(actor, id, dto.role, dto.reason);
  }
}
