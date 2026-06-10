export interface Comment {
  id: string;
  ticketId: string;
  authorId: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommentRequest {
  body: string;
  isInternal?: boolean;
}
