import { IsOptional, IsIn, IsString, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ApprovalQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by approval status',
    enum: ['pending', 'approved', 'rejected', 'cancelled', 'expired'],
    default: 'pending',
  })
  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected', 'cancelled', 'expired'])
  status?: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';

  @ApiPropertyOptional({ description: 'Filter by approval type category (e.g. message_send)' })
  @IsOptional()
  @IsString()
  approvalType?: string;

  @ApiPropertyOptional({ description: 'Filter by target entity type (e.g. message, deal, lead)' })
  @IsOptional()
  @IsString()
  entityType?: string;

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
