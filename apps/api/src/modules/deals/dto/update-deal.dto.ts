import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsDateString,
  MaxLength,
  IsInt,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateDealDto {
  @ApiProperty({
    description: 'Current version of the deal for optimistic concurrency control',
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  version!: number;

  @ApiPropertyOptional({ description: 'Deal title or opportunity name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: 'Monetary value of the deal', example: 750000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  value?: number;

  @ApiPropertyOptional({ description: 'Currency code', default: 'INR' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @ApiPropertyOptional({ description: 'Target or expected close date' })
  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string;

  @ApiPropertyOptional({ description: 'User ID of the assigned deal owner, or null to unassign' })
  @IsOptional()
  @IsUUID()
  ownerId?: string | null;

  @ApiPropertyOptional({ description: 'Estimated close probability (0 - 100%)', example: 75 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  probability?: number | null;

  @ApiPropertyOptional({ description: 'Next scheduled action or milestone' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nextAction?: string | null;

  @ApiPropertyOptional({ description: 'Reason for win or loss' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  winLossReason?: string | null;

  @ApiPropertyOptional({ description: 'Move deal to a different pipeline stage' })
  @IsOptional()
  @IsUUID()
  stageId?: string;
}
