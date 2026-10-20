import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from '@leadforge/shared';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Password reset token received via email' })
  @IsString()
  @IsNotEmpty({ message: 'Token is required' })
  token!: string;

  @ApiProperty({
    example: 'NewSecurePassword123!',
    description: `New password (minimum ${MIN_PASSWORD_LENGTH} characters)`,
  })
  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH, {
    message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
  })
  @MaxLength(MAX_PASSWORD_LENGTH, {
    message: `Password cannot exceed ${MAX_PASSWORD_LENGTH} characters`,
  })
  newPassword!: string;
}
