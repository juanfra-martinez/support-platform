import { ApiProperty } from '@nestjs/swagger';
import { IsJWT } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'A previously issued refresh token' })
  @IsJWT()
  refreshToken!: string;
}
