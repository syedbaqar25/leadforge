import { IsNotEmpty, IsUUID, IsOptional, IsString, MaxLength, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class MoveDealStageDto {
  @ApiProperty({ description: 'Target pipeline stage ID' })
  @IsUUID()
  @IsNotEmpty()
  stageId!: string;

  @ApiProperty({
    description: 'Current version of the deal for optimistic concurrency control',
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  version!: number;

  @ApiPropertyOptional({ description: 'Optional win or loss reason (relevant when closing)' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  winLossReason?: string;
}
