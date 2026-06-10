import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ example: 'We have reproduced the issue and are working on a fix.' })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Internal notes are hidden from customers',
  })
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}
