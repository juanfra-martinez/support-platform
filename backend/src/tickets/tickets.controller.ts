import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { TicketQueryDto } from './dto/ticket-query.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketsService } from './tickets.service';

@ApiTags('tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly service: TicketsService) {}

  private correlationId(req: Request): string | undefined {
    return (req as Request & { correlationId?: string }).correlationId;
  }

  @Post()
  @ApiOperation({ summary: 'Create a ticket (publishes ticket.created)' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTicketDto,
    @Req() req: Request,
  ) {
    return this.service.create(user, dto, this.correlationId(req));
  }

  @Get()
  @ApiOperation({ summary: 'List tickets (scoped by role) with filters' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: TicketQueryDto,
  ) {
    return this.service.findAll(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a ticket by id' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(user, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a ticket (publishes ticket.updated/closed)' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketDto,
    @Req() req: Request,
  ) {
    return this.service.update(user, id, dto, this.correlationId(req));
  }

  @Patch(':id/assign')
  @Roles(Role.ADMIN, Role.AGENT)
  @ApiOperation({ summary: 'Assign a ticket (publishes ticket.assigned)' })
  assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTicketDto,
    @Req() req: Request,
  ) {
    return this.service.assign(user, id, dto, this.correlationId(req));
  }
}
