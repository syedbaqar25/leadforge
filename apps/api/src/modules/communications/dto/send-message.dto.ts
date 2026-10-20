import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsUUID,
  IsOptional,
  IsObject,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ description: 'Target Lead UUID' })
  @IsUUID()
  @IsNotEmpty()
  leadId!: string;

  @ApiProperty({ description: 'Communication channel', enum: ['email', 'whatsapp'] })
  @IsNotEmpty()
  @IsIn(['email', 'whatsapp'])
  channel!: 'email' | 'whatsapp';

  @ApiProperty({
    description: 'Recipient email address or phone number',
    example: 'alex@company.com',
  })
  @IsString()
  @IsNotEmpty()
  toAddress!: string;

  @ApiPropertyOptional({ description: 'Subject line (required for email)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  subject?: string;

  @ApiProperty({ description: 'Message body or rendered template content' })
  @IsString()
  @IsNotEmpty()
  body!: string;

  @ApiPropertyOptional({
    description: 'Optional ID of pre-existing Message record being dispatched',
  })
  @IsOptional()
  @IsUUID()
  messageId?: string;

  @ApiPropertyOptional({ description: 'Optional Template ID if sending from a template' })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ApiPropertyOptional({
    description: 'Template variables to interpolate',
    example: { firstName: 'Alex', company: 'Acme' },
  })
  @IsOptional()
  @IsObject()
  templateVariables?: Record<string, string>;
}
