import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { CommentsService } from './comments.service';
import { CommentQueryDto } from './dto/comment-query.dto';
import { CreateCommentDto } from './dto/create-comment.dto';

@ApiTags('comments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tickets/:ticketId/comments')
export class CommentsController {
  constructor(private readonly service: CommentsService) {}

  @Post()
  @ApiOperation({ summary: 'Add a comment to a ticket (publishes comment.created)' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() dto: CreateCommentDto,
    @Req() req: Request,
  ) {
    const correlationId = (req as Request & { correlationId?: string })
      .correlationId;
    return this.service.create(user, ticketId, dto, correlationId);
  }

  @Get()
  @ApiOperation({ summary: 'List comments for a ticket' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Query() query: CommentQueryDto,
  ) {
    return this.service.findForTicket(user, ticketId, query);
  }
}
