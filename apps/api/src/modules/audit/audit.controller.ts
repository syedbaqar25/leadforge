import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiProduces } from '@nestjs/swagger';
import { Response } from 'express';
import { AuditService } from './audit.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { CurrentOrgId, RequirePermissions } from '../../common/decorators/tenant.decorator';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions('audit:view')
  @ApiOperation({ summary: 'Query immutable tenant audit logs with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Paginated audit logs list' })
  async getAuditLogs(@CurrentOrgId() orgId: string, @Query() query: AuditLogQueryDto) {
    return this.auditService.getAuditLogs(orgId, query);
  }

  @Get('export')
  @RequirePermissions('audit:export')
  @ApiProduces('text/csv')
  @ApiOperation({ summary: 'Export audit logs to CSV with formula injection sanitization' })
  @ApiResponse({ status: 200, description: 'CSV file download with sanitized cells' })
  async exportAuditLogs(
    @CurrentOrgId() orgId: string,
    @Query('action') action: string | undefined,
    @Query('entityType') entityType: string | undefined,
    @Res() res: Response,
  ) {
    const csvContent = await this.auditService.exportAuditLogsCsv(orgId, action, entityType);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${Date.now()}.csv"`);
    res.send(csvContent);
  }
}
