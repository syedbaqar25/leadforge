import { IsArray, ValidateNested, IsUUID, IsInt, Min, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class StageOrderItem {
  @ApiProperty({ description: 'Stage ID' })
  @IsUUID()
  id!: string;

  @ApiProperty({ description: 'New sort order index', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sortOrder!: number;
}

export class ReorderStagesDto {
  @ApiProperty({ description: 'Array of stage IDs with new sort orders', type: [StageOrderItem] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StageOrderItem)
  stageOrders!: StageOrderItem[];
}
