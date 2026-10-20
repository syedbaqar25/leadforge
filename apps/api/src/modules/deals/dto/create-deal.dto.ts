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
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateDealDto {
  @ApiProperty({ description: 'ID of the lead associated with this deal' })
  @IsUUID()
  @IsNotEmpty()
  leadId!: string;

  @ApiProperty({ description: 'ID of the sales pipeline' })
  @IsUUID()
  @IsNotEmpty()
  pipelineId!: string;

  @ApiProperty({ description: 'ID of the initial pipeline stage' })
  @IsUUID()
  @IsNotEmpty()
  stageId!: string;

  @ApiProperty({
    description: 'Deal title or opportunity name',
    example: 'Enterprise Cloud Migration',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({ description: 'Monetary value of the deal', example: 500000 })
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

  @ApiPropertyOptional({ description: 'User ID of the assigned deal owner' })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional({ description: 'Estimated close probability (0 - 100%)', example: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  probability?: number;

  @ApiPropertyOptional({ description: 'Next scheduled action or milestone' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nextAction?: string;

  @ApiPropertyOptional({ description: 'Reason for win or loss if immediately closed' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  winLossReason?: string;
}
