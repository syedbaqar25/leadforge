import { IsString, IsNotEmpty, IsOptional, IsIn, IsInt, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateStageDto {
  @ApiProperty({ description: 'Stage name', example: 'Technical Evaluation' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ description: 'Sort order index in pipeline sequence', example: 4 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sortOrder!: number;

  @ApiPropertyOptional({
    description: 'Stage type category',
    enum: ['open', 'won', 'lost'],
    default: 'open',
  })
  @IsOptional()
  @IsIn(['open', 'won', 'lost'])
  stageType?: 'open' | 'won' | 'lost';
}
