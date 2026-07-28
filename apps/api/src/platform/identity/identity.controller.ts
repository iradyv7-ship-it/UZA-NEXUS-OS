import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { IdentityService } from './identity.service';
import type { RoleName } from '@prisma/client';

const ROLES = [
  'ceo', 'venture_manager', 'china_sourcing', 'china_warehouse',
  'front_office', 'finance', 'sales_agent', 'customer', 'logistics_partner',
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
  @IsString() assignedById!: string;
  @IsOptional() @IsString() reason?: string;
}

/**
 * Administrative identity endpoints. In production these sit behind a CEO/venture_manager
 * guard (see handoff, "auth requirements"); the guard binding lands with the web module's
 * auth flow. The authorisation *rules* are enforced in the service layer per the contract.
 */
@ApiTags('identity')
@ApiBearerAuth()
@Controller('identity')
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Post('organisations')
  createOrg(@Body() dto: CreateOrgDto) {
    return this.identity.createOrganisation(dto.name);
  }

  @Post('offices')
  createOffice(@Body() dto: CreateOfficeDto) {
    return this.identity.createOffice(dto.organisationId, dto.code, dto.name);
  }

  @Post('employees')
  createEmployee(@Body() dto: CreateUserDto) {
    return this.identity.createEmployee(dto);
  }

  @Post('partners')
  createPartner(@Body() dto: CreatePartnerDto) {
    return this.identity.createPartnerAccount(dto, new Date(dto.expiresAt));
  }

  @Post('users/:id/roles')
  assignRole(@Param('id') id: string, @Body() dto: AssignRoleDto) {
    return this.identity.assignRole(id, dto.role, dto.assignedById, dto.reason);
  }
}
