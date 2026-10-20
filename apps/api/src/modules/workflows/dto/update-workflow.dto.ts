import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsObject,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  WorkflowTriggerInput,
  WorkflowConditionInput,
  WorkflowActionInput,
} from './create-workflow.dto';

export class UpdateWorkflowDto {
  @ApiPropertyOptional({ description: 'Workflow name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Enable or disable workflow' })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Test/sandbox mode' })
  @IsOptional()
  @IsBoolean()
  testMode?: boolean;

  @ApiPropertyOptional({ description: 'Concurrency limit' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  concurrencyLimit?: number;

  @ApiPropertyOptional({ description: 'Updated trigger definition' })
  @IsOptional()
  @IsObject()
  trigger?: WorkflowTriggerInput;

  @ApiPropertyOptional({ description: 'Updated conditions', type: [WorkflowConditionInput] })
  @IsOptional()
  @IsArray()
  conditions?: WorkflowConditionInput[];

  @ApiPropertyOptional({ description: 'Updated actions', type: [WorkflowActionInput] })
  @IsOptional()
  @IsArray()
  actions?: WorkflowActionInput[];
}
