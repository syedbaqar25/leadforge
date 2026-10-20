import { IsNotEmpty, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateDraftDto {
  @ApiProperty({
    description: 'Target communication channel',
    enum: ['email', 'whatsapp'],
    default: 'email',
  })
  @IsNotEmpty()
  @IsIn(['email', 'whatsapp'])
  channel!: 'email' | 'whatsapp';

  @ApiPropertyOptional({
    description: 'Tone of voice for message generation',
    enum: ['professional', 'conversational', 'urgent', 'consultative'],
    default: 'consultative',
  })
  @IsOptional()
  @IsIn(['professional', 'conversational', 'urgent', 'consultative'])
  tone?: 'professional' | 'conversational' | 'urgent' | 'consultative';

  @ApiPropertyOptional({
    description: 'Strategic objective of the communication',
    enum: [
      'initial_pitch',
      'follow_up',
      'meeting_request',
      'objection_handling',
      'proposal_overview',
    ],
    default: 'initial_pitch',
  })
  @IsOptional()
  @IsIn([
    'initial_pitch',
    'follow_up',
    'meeting_request',
    'objection_handling',
    'proposal_overview',
  ])
  goal?:
    'initial_pitch' | 'follow_up' | 'meeting_request' | 'objection_handling' | 'proposal_overview';

  @ApiPropertyOptional({
    description: 'Specific points, offers, or guidance to include in the draft',
    example: 'Mention our 20% early adopter discount valid through Friday.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  customInstructions?: string;
}
