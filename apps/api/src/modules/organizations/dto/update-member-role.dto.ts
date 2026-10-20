import { IsIn, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { type Role } from '@leadforge/shared';

export class UpdateMemberRoleDto {
  @ApiProperty({
    example: 'sales_manager',
    enum: ['owner', 'admin', 'sales_manager', 'salesperson'],
  })
  @IsNotEmpty()
  @IsIn(['owner', 'admin', 'sales_manager', 'salesperson'], {
    message: 'Role must be owner, admin, sales_manager, or salesperson',
  })
  role!: Role;
}
