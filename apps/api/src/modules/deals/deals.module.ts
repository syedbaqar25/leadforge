import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { DealsService } from './deals.service';
import { DealsController } from './deals.controller';
import { PipelinesController } from './pipelines.controller';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [DealsController, PipelinesController],
  providers: [DealsService],
  exports: [DealsService],
})
export class DealsModule {}
