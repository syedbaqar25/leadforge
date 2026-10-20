import { IsString, IsNotEmpty, IsIn, IsBoolean, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecordConsentDto {
  @ApiProperty({ description: 'Communication channel', enum: ['email', 'whatsapp'] })
  @IsNotEmpty()
  @IsIn(['email', 'whatsapp'])
  channel!: string;

  @ApiProperty({ description: 'Consent granted (true) or revoked/denied (false)' })
  @IsBoolean()
  consentGiven!: boolean;

  @ApiPropertyOptional({
    description: 'Method through which consent was obtained',
    enum: ['web_form', 'verbal', 'contract', 'double_opt_in', 'written'],
    default: 'web_form',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  consentMethod?: string;
}
