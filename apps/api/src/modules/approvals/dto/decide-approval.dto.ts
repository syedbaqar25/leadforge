import {
  IsNotEmpty,
  IsIn,
  IsInt,
  Min,
  IsOptional,
  IsString,
  MaxLength,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class DecideApprovalDto {
  @ApiProperty({
    description: 'Decision outcome',
    enum: ['approved', 'rejected'],
    example: 'approved',
  })
  @IsNotEmpty()
  @IsIn(['approved', 'rejected'])
  decision!: 'approved' | 'rejected';

  @ApiProperty({
    description: 'Current version of the approval request for optimistic concurrency control',
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  version!: number;

  @ApiPropertyOptional({
    description: 'Reviewer feedback or reason for decision / rejection',
    example: 'Approved with minor edits to opening pitch.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  feedback?: string;

  @ApiPropertyOptional({
    description: 'Optional reviewer modifications to the proposed payload prior to approval',
  })
  @IsOptional()
  @IsObject()
  editedPayload?: Record<string, any>;
}
