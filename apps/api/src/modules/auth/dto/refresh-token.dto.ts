import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description: 'Refresh token (optional if provided via HttpOnly cookie)',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
