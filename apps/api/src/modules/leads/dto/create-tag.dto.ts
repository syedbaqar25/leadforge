import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateTagDto {
  @ApiProperty({ example: 'Enterprise' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  @ApiPropertyOptional({ example: '#D64933' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;
}
