import { IsNotEmpty, IsObject, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MergeLeadsDto {
  @ApiProperty({ description: 'ID of the lead that will be preserved' })
  @IsUUID('4')
  @IsNotEmpty()
  survivingLeadId!: string;

  @ApiProperty({ description: 'ID of the lead that will be merged and soft-deleted' })
  @IsUUID('4')
  @IsNotEmpty()
  duplicateLeadId!: string;

  @ApiPropertyOptional({
    description: 'Optional field overrides to apply to the surviving lead',
    example: { company: 'Consolidated Corp', email: 'primary@example.com' },
  })
  @IsOptional()
  @IsObject()
  overrideFields?: Record<string, any>;
}
