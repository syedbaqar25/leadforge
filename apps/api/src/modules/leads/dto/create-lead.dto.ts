import {
  IsArray,
  IsEmail,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { type Priority } from '@leadforge/shared';

export class CreateLeadDto {
  @ApiProperty({ example: 'David Miller', description: 'Lead contact full name' })
  @IsString()
  @MaxLength(150)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  fullName!: string;

  @ApiPropertyOptional({ example: 'david.miller@example.com' })
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

  @ApiPropertyOptional({ example: 'Apex Logistics Inc' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  company?: string;

  @ApiPropertyOptional({ example: 'VP of Procurement' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  jobTitle?: string;

  @ApiPropertyOptional({ example: 'https://apexlogistics.com' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  website?: string;

  @ApiPropertyOptional({ example: 'Mumbai, India' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @ApiPropertyOptional({ example: 'Logistics & Supply Chain' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @ApiPropertyOptional({ example: 'website_inbound' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  source?: string;

  @ApiPropertyOptional({ example: 'q4_enterprise_campaign' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  campaign?: string;

  @ApiPropertyOptional({
    example: 250000,
    description: 'Estimated budget in organization currency',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetAmount?: number;

  @ApiPropertyOptional({ example: 'INR' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  budgetCurrency?: string;

  @ApiPropertyOptional({ example: 'Seeking full enterprise sales automation for 50 reps' })
  @IsOptional()
  @IsString()
  requirements?: string;

  @ApiPropertyOptional({ example: 'Q1 2027' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  purchaseTimeline?: string;

  @ApiPropertyOptional({ example: 'high', enum: ['low', 'medium', 'high', 'urgent'] })
  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'urgent'])
  priority?: Priority;

  @ApiPropertyOptional({ example: 'user-uuid-123' })
  @IsOptional()
  @IsUUID('4')
  assignedToId?: string;

  @ApiPropertyOptional({ example: ['enterprise', 'high-intent'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    example: { 'custom-field-def-id': 'value' },
    description: 'Custom field values mapped by custom field definition ID',
  })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, string>;
}
