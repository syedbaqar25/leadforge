import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsOptional,
  IsArray,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTemplateDto {
  @ApiProperty({ description: 'Template name', example: 'Enterprise Intro Pitch' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ description: 'Communication channel', enum: ['email', 'whatsapp'] })
  @IsNotEmpty()
  @IsIn(['email', 'whatsapp'])
  channel!: 'email' | 'whatsapp';

  @ApiPropertyOptional({ description: 'Subject line (required for email templates)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  subject?: string;

  @ApiProperty({
    description: 'Message body with template tags like {{firstName}}, {{company}}',
    example: 'Hi {{firstName}}, great connecting with {{company}}...',
  })
  @IsString()
  @IsNotEmpty()
  body!: string;

  @ApiPropertyOptional({
    description: 'Array of detected or allowed variable names',
    example: ['firstName', 'company'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variables?: string[];

  @ApiPropertyOptional({
    description: 'Whether messages from this template require manager approval',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;
}
