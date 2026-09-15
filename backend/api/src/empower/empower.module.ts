import { Module } from '@nestjs/common';
import { PlanningModule } from '../planning/planning.module';
import { EmpowerClientService } from './empower-client.service';
import { EmpowerController } from './empower.controller';

@Module({
  imports: [PlanningModule],
  controllers: [EmpowerController],
  providers: [EmpowerClientService],
})
export class EmpowerModule {}
