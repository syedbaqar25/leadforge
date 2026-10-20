import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from '@leadforge/shared';

export class RegisterDto {
  @ApiProperty({ example: 'sarah.connor@example.com', description: 'User work email address' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  email!: string;

  @ApiProperty({
    example: 'K7#m9$vL2!pQ',
    description: `User password (minimum ${MIN_PASSWORD_LENGTH} characters)`,
  })
  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH, {
    message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
  })
  @MaxLength(MAX_PASSWORD_LENGTH, {
    message: `Password cannot exceed ${MAX_PASSWORD_LENGTH} characters`,
  })
  password!: string;

  @ApiProperty({ example: 'Sarah Connor', description: 'Full name' })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  @ApiPropertyOptional({
    example: 'Apex Technologies',
    description: 'Name of the organization to create (required if not accepting an invitation)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  organizationName?: string;

  @ApiPropertyOptional({
    example: 'a8f3b2e1...',
    description: 'Optional invitation token if signing up via an invite link',
  })
  @IsOptional()
  @IsString()
  invitationToken?: string;
}
