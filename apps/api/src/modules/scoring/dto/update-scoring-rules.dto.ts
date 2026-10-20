import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ScoringRuleItemDto {
  @ApiProperty({ example: 'budget' })
  @IsNotEmpty()
  criterion!: string;

  @ApiProperty({ example: 30 })
  weight!: number;

  @ApiProperty({ example: { tier1: 500000, tier2: 100000 } })
  @IsObject()
  parameters!: Record<string, any>;
}

export class UpdateScoringRulesDto {
  @ApiProperty({
    description: 'Array of weighted scoring rules or JSON configuration object',
    example: {
      budgetThresholds: { high: 500000, medium: 100000 },
      timelineUrgency: { immediate: 25, shortTerm: 15, mediumTerm: 5 },
      seniorityTitles: ['c-level', 'vp', 'director', 'founder', 'head'],
      industryBoosts: ['technology', 'saas', 'logistics', 'manufacturing'],
    },
  })
  @IsObject()
  rules!: Record<string, any>;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  recalculateAllLeads?: boolean;
}
