import { IsString, IsNotEmpty, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePipelineDto {
  @ApiPropertyOptional({ description: 'Pipeline name', example: 'Enterprise Pipeline V2' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Set as default pipeline for this organization' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
