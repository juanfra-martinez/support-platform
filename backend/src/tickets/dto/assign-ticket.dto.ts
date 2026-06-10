import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignTicketDto {
  @ApiProperty({ description: 'Id of the agent to assign the ticket to' })
  @IsUUID()
  assigneeId!: string;
}
