import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateNoteDto {
  @ApiProperty({ example: 'Discussed procurement approval timeline. Target decision by Friday.' })
  @IsString()
  @IsNotEmpty({ message: 'Note content cannot be empty' })
  @MaxLength(10000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  content!: string;
}
