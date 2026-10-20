import { IsOptional, IsString, IsIn, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AnalyzeLeadDto {
  @ApiPropertyOptional({
    description: 'Specific focus area for the AI analysis',
    enum: ['qualification', 'objections', 'next_actions', 'full'],
    default: 'full',
  })
  @IsOptional()
  @IsIn(['qualification', 'objections', 'next_actions', 'full'])
  focus?: 'qualification' | 'objections' | 'next_actions' | 'full';

  @ApiPropertyOptional({
    description: 'Additional contextual notes or user instructions for the AI prompt',
    example: 'Client mentioned they are evaluating Salesforce and HubSpot currently.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  contextNotes?: string;
}
