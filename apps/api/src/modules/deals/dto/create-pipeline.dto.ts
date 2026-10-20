import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  MaxLength,
  IsIn,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class InitialStageInput {
  @ApiProperty({ description: 'Stage name', example: 'Lead In' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ description: 'Sort order index', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sortOrder!: number;

  @ApiPropertyOptional({
    description: 'Stage type',
    enum: ['open', 'won', 'lost'],
    default: 'open',
  })
  @IsOptional()
  @IsIn(['open', 'won', 'lost'])
  stageType?: 'open' | 'won' | 'lost';
}

export class CreatePipelineDto {
  @ApiProperty({ description: 'Pipeline name', example: 'Enterprise Outbound Pipeline' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({
    description: 'Set as default pipeline for this organization',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({
    description: 'Optional custom initial stages to create with the pipeline',
    type: [InitialStageInput],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InitialStageInput)
  stages?: InitialStageInput[];
}
