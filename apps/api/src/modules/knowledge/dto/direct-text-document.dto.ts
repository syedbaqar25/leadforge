import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, MinLength, IsOptional } from 'class-validator';

export class DirectTextDocumentDto {
  @ApiProperty({ description: 'Document title/filename', example: 'Product_Pricing_2026.md' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @ApiProperty({
    description: 'Text or Markdown content of the knowledge document',
    example: '# Leadforge Enterprise Pricing\n\nStarting at $499/month for unlimited team seats...',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  content!: string;

  @ApiPropertyOptional({
    description: 'MIME type of the content',
    default: 'text/markdown',
    example: 'text/markdown',
  })
  @IsOptional()
  @IsString()
  mimeType?: string;
}
