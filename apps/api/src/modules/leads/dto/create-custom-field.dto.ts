import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { type CustomFieldType } from '@leadforge/shared';

export class CreateCustomFieldDto {
  @ApiProperty({ example: 'Budget Approval Authority' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  @ApiProperty({ example: 'select', enum: ['text', 'number', 'date', 'select'] })
  @IsNotEmpty()
  @IsIn(['text', 'number', 'date', 'select'])
  fieldType!: CustomFieldType;

  @ApiPropertyOptional({ example: ['VP', 'Director', 'Manager', 'Board'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ example: 1, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
