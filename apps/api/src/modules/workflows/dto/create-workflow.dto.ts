import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsArray,
  IsObject,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class WorkflowTriggerInput {
  @ApiProperty({
    description: 'Trigger event type',
    enum: [
      'lead_created',
      'score_changed',
      'stage_entered',
      'deal_won',
      'deal_lost',
      'task_overdue',
    ],
    example: 'score_changed',
  })
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiPropertyOptional({
    description: 'Trigger configuration settings',
    example: { minScore: 75, targetBand: 'hot' },
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}

export class WorkflowConditionInput {
  @ApiProperty({ description: 'Payload field path to evaluate', example: 'score' })
  @IsString()
  @IsNotEmpty()
  field!: string;

  @ApiProperty({
    description: 'Comparison operator',
    enum: ['equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'in'],
    example: 'greater_than',
  })
  @IsString()
  @IsNotEmpty()
  operator!: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in';

  @ApiProperty({ description: 'Expected comparison value', example: 70 })
  value!: any;
}

export class WorkflowActionInput {
  @ApiProperty({
    description: 'Action execution type',
    enum: [
      'create_task',
      'update_lead',
      'send_notification',
      'trigger_webhook',
      'draft_ai_message',
    ],
    example: 'create_task',
  })
  @IsString()
  @IsNotEmpty()
  type!:
    'create_task' | 'update_lead' | 'send_notification' | 'trigger_webhook' | 'draft_ai_message';

  @ApiProperty({
    description: 'Action execution parameters',
    example: { taskType: 'call', title: 'Hot Lead Immediate Callback', priority: 'urgent' },
  })
  @IsObject()
  params!: Record<string, any>;
}

export class CreateWorkflowDto {
  @ApiProperty({ description: 'Workflow name', example: 'Hot Lead Instant Outreach Flow' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ description: 'Description of the automation purpose' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Whether the automation is actively running',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Run in test/sandbox mode without dispatching external side effects',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  testMode?: boolean;

  @ApiPropertyOptional({ description: 'Max concurrent executions', default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  concurrencyLimit?: number;

  @ApiProperty({ description: 'Trigger definition' })
  @IsObject()
  trigger!: WorkflowTriggerInput;

  @ApiPropertyOptional({
    description: 'Evaluation conditions (all must match)',
    type: [WorkflowConditionInput],
  })
  @IsOptional()
  @IsArray()
  conditions?: WorkflowConditionInput[];

  @ApiProperty({ description: 'Sequential actions to execute', type: [WorkflowActionInput] })
  @IsArray()
  actions!: WorkflowActionInput[];
}
