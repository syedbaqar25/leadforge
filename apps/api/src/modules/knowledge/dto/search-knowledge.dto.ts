import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchKnowledgeDto {
  @ApiProperty({
    description: 'Natural language search query for semantic vector lookup',
    example: 'What is our enterprise SLA and refund policy?',
  })
  @IsString()
  @IsNotEmpty()
  query!: string;

  @ApiPropertyOptional({
    description: 'Maximum number of relevant chunks to retrieve',
    default: 5,
    minimum: 1,
    maximum: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Minimum cosine similarity threshold (0.0 to 1.0)',
    default: 0.3,
    minimum: 0.0,
    maximum: 1.0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0)
  @Max(1.0)
  minSimilarity?: number;
}
