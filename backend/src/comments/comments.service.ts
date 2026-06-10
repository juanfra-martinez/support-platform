import { ForbiddenException, Injectable } from '@nestjs/common';
import { Comment, Prisma, Role } from '@prisma/client';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import {
  buildPaginatedResult,
  toPrismaPage,
} from '../common/utils/pagination.util';
import { RoutingKeys } from '../messaging/contracts/routing-keys';
import { EventPublisherService } from '../messaging/event-publisher.service';
import { PrismaService } from '../prisma/prisma.service';
import { TicketsService } from '../tickets/tickets.service';
import { CommentQueryDto } from './dto/comment-query.dto';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tickets: TicketsService,
    private readonly events: EventPublisherService,
  ) {}

  async create(
    actor: AuthenticatedUser,
    ticketId: string,
    dto: CreateCommentDto,
    correlationId?: string,
  ): Promise<Comment> {
    // Reuses ticket access control (throws if the actor cannot see the ticket).
    await this.tickets.findOne(actor, ticketId);

    // Only staff may post internal notes.
    const isInternal =
      actor.role === Role.CUSTOMER ? false : (dto.isInternal ?? false);

    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: {
          ticketId,
          authorId: actor.id,
          body: dto.body,
          isInternal,
        },
      });

      await this.events.enqueue(
        tx,
        RoutingKeys.CommentCreated,
        {
          commentId: comment.id,
          ticketId,
          organizationId: actor.organizationId,
          authorId: actor.id,
          isInternal,
        },
        correlationId,
      );

      return comment;
    });
  }

  async findForTicket(
    actor: AuthenticatedUser,
    ticketId: string,
    query: CommentQueryDto,
  ): Promise<PaginatedResult<Comment>> {
    await this.tickets.findOne(actor, ticketId);

    const where: Prisma.CommentWhereInput = {
      ticketId,
      // Customers never see internal notes.
      ...(actor.role === Role.CUSTOMER ? { isInternal: false } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.comment.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        ...toPrismaPage(query),
      }),
      this.prisma.comment.count({ where }),
    ]);

    return buildPaginatedResult(items, total, query);
  }
}
