import { IsEmail, IsIn, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { type Role } from '@leadforge/shared';

export class InviteMemberDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail({}, { message: 'Valid email address is required' })
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  email!: string;

  @ApiProperty({ example: 'salesperson', enum: ['admin', 'sales_manager', 'salesperson'] })
  @IsNotEmpty()
  @IsIn(['admin', 'sales_manager', 'salesperson'], {
    message: 'Role must be admin, sales_manager, or salesperson',
  })
  role!: Exclude<Role, 'owner'>;
}
