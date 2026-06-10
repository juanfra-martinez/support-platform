import { Role } from '@prisma/client';

/**
 * The shape attached to `request.user` by the JWT strategy and surfaced through
 * the `@CurrentUser()` decorator.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  organizationId: string;
}
