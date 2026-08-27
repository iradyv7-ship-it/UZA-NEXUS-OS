import { Module } from '@nestjs/common';
import { UzaIdController } from './uza-id.controller';
import { UzaIdService } from './uza-id.service';

/**
 * The UZA ID: one person, one identifier, across every UZA system.
 *
 * Sits in `platform` rather than in a business module because it is foundation — the
 * charging platform, the Mobility platform, the candidate portal and the taxi app all
 * depend on it, and none of them depends on the others.
 *
 * PrismaModule is @Global, so it is not imported here.
 */
@Module({
  controllers: [UzaIdController],
  providers: [UzaIdService],
  exports: [UzaIdService],
})
export class UzaIdModule {}
