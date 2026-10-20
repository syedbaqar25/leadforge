import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
  type LeadStatus,
  type Priority,
  type ScoreBand,
} from '@leadforge/shared';

export class LeadQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 25, default: DEFAULT_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize?: number = DEFAULT_PAGE_SIZE;

  @ApiPropertyOptional({ description: 'Optional cursor for cursor-based pagination' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ description: 'Search term across name, company, email, phone' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    enum: ['new', 'contacted', 'qualified', 'unqualified', 'nurturing', 'converted', 'lost'],
  })
  @IsOptional()
  @IsIn(['new', 'contacted', 'qualified', 'unqualified', 'nurturing', 'converted', 'lost'])
  status?: LeadStatus;

  @ApiPropertyOptional({ enum: ['low', 'medium', 'high', 'urgent'] })
  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'urgent'])
  priority?: Priority;

  @ApiPropertyOptional({ enum: ['hot', 'warm', 'cold'] })
  @IsOptional()
  @IsIn(['hot', 'warm', 'cold'])
  scoreBand?: ScoreBand;

  @ApiPropertyOptional({ description: 'Filter by assigned user UUID' })
  @IsOptional()
  @IsString()
  assignedToId?: string;

  @ApiPropertyOptional({ example: 'website_inbound' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ example: '2026-01-01T00:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  from?: Date;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.999Z' })
  @IsOptional()
  @Type(() => Date)
  to?: Date;

  @ApiPropertyOptional({ example: 'createdAt', default: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
