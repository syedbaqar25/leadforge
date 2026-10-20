import { IsOptional, IsUUID, IsIn, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class MessageQueryDto {
  @ApiPropertyOptional({ description: 'Filter messages by lead UUID' })
  @IsOptional()
  @IsUUID()
  leadId?: string;

  @ApiPropertyOptional({
    description: 'Filter by communication channel',
    enum: ['email', 'whatsapp'],
  })
  @IsOptional()
  @IsIn(['email', 'whatsapp'])
  channel?: 'email' | 'whatsapp';

  @ApiPropertyOptional({
    description: 'Filter by message direction',
    enum: ['inbound', 'outbound'],
  })
  @IsOptional()
  @IsIn(['inbound', 'outbound'])
  direction?: 'inbound' | 'outbound';

  @ApiPropertyOptional({
    description: 'Filter by message delivery status',
    enum: [
      'draft',
      'pending_approval',
      'approved',
      'sending',
      'sent',
      'delivered',
      'read',
      'failed',
      'bounced',
    ],
  })
  @IsOptional()
  @IsIn([
    'draft',
    'pending_approval',
    'approved',
    'sending',
    'sent',
    'delivered',
    'read',
    'failed',
    'bounced',
  ])
  status?:
    | 'draft'
    | 'pending_approval'
    | 'approved'
    | 'sending'
    | 'sent'
    | 'delivered'
    | 'read'
    | 'failed'
    | 'bounced';

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page size', default: 25, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 25;
}
