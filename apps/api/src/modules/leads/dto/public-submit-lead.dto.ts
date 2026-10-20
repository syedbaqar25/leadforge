import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class PublicSubmitLeadDto {
  @ApiProperty({ example: 'apex-technologies-123', description: 'Organization slug or ID' })
  @IsString()
  @IsNotEmpty({ message: 'Organization slug is required' })
  organizationSlug!: string;

  @ApiProperty({ example: 'Jane Foster' })
  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  @MaxLength(150)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  fullName!: string;

  @ApiPropertyOptional({ example: 'jane.foster@example.com' })
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  email?: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ example: 'Foster Research Labs' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  company?: string;

  @ApiPropertyOptional({ example: 'Need demo for enterprise CRM integration' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  requirements?: string;

  @ApiPropertyOptional({ description: 'Cloudflare Turnstile captcha token if enabled' })
  @IsOptional()
  @IsString()
  turnstileToken?: string;
}
