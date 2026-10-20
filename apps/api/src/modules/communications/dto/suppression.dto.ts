import { IsString, IsNotEmpty, IsIn, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddSuppressionDto {
  @ApiProperty({ description: 'Communication channel', enum: ['email', 'whatsapp'] })
  @IsNotEmpty()
  @IsIn(['email', 'whatsapp'])
  channel!: string;

  @ApiProperty({
    description: 'Email address or phone number to suppress',
    example: 'unsubscribed@prospect.com',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  identifier!: string;

  @ApiProperty({
    description: 'Reason for suppression',
    enum: ['unsubscribe', 'spam_complaint', 'hard_bounce', 'manual_request', 'legal_dnd'],
    example: 'unsubscribe',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  reason!: string;
}
