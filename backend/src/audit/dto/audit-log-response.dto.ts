import { ApiProperty } from '@nestjs/swagger';

export class AuditLogResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() action!: string;
  @ApiProperty() entityType!: string;
  @ApiProperty() entityId!: string;
  @ApiProperty({ nullable: true }) actorId!: string | null;
  @ApiProperty({ nullable: true }) correlationId!: string | null;
  @ApiProperty({ nullable: true, type: Object }) metadata!: unknown;
  @ApiProperty() createdAt!: Date;
}
