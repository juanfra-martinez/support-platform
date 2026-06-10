/**
 * Database seed.
 *
 * Creates a demo organization with one user per role plus a handful of tickets
 * and comments so a reviewer can log in immediately and explore every feature.
 *
 * Run with: `npm run prisma:seed`
 */
import {
  PrismaClient,
  Role,
  TicketPriority,
  TicketStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;
const DEMO_PASSWORD = 'Password123!';

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);

  const organization = await prisma.organization.upsert({
    where: { slug: 'acme-inc' },
    update: {},
    create: { name: 'Acme Inc.', slug: 'acme-inc' },
  });

  const [admin, agent, customer] = await Promise.all([
    prisma.user.upsert({
      where: { email: 'admin@acme.test' },
      update: {},
      create: {
        email: 'admin@acme.test',
        passwordHash,
        firstName: 'Alice',
        lastName: 'Admin',
        role: Role.ADMIN,
        organizationId: organization.id,
      },
    }),
    prisma.user.upsert({
      where: { email: 'agent@acme.test' },
      update: {},
      create: {
        email: 'agent@acme.test',
        passwordHash,
        firstName: 'Gary',
        lastName: 'Agent',
        role: Role.AGENT,
        organizationId: organization.id,
      },
    }),
    prisma.user.upsert({
      where: { email: 'customer@acme.test' },
      update: {},
      create: {
        email: 'customer@acme.test',
        passwordHash,
        firstName: 'Carol',
        lastName: 'Customer',
        role: Role.CUSTOMER,
        organizationId: organization.id,
      },
    }),
  ]);

  const existing = await prisma.ticket.count({
    where: { organizationId: organization.id },
  });

  if (existing === 0) {
    const seedTickets = [
      {
        title: 'Cannot log in to the dashboard',
        description: 'Login returns a 500 error after the latest release.',
        priority: TicketPriority.HIGH,
        status: TicketStatus.OPEN,
        assignedToId: agent.id,
      },
      {
        title: 'Export to CSV is missing columns',
        description: 'The ticket export omits the assignee and priority columns.',
        priority: TicketPriority.MEDIUM,
        status: TicketStatus.IN_PROGRESS,
        assignedToId: agent.id,
      },
      {
        title: 'Request: dark mode',
        description: 'Would love a dark theme for the agent console.',
        priority: TicketPriority.LOW,
        status: TicketStatus.PENDING,
        assignedToId: null,
      },
    ];

    let sequence = 1;
    for (const t of seedTickets) {
      const ticket = await prisma.ticket.create({
        data: {
          reference: `TKT-${String(sequence).padStart(6, '0')}`,
          title: t.title,
          description: t.description,
          priority: t.priority,
          status: t.status,
          organizationId: organization.id,
          createdById: customer.id,
          assignedToId: t.assignedToId,
        },
      });
      sequence += 1;

      await prisma.comment.create({
        data: {
          ticketId: ticket.id,
          authorId: agent.id,
          body: 'Thanks for reporting this. We are looking into it.',
          isInternal: false,
        },
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log('Seed complete.');
  // eslint-disable-next-line no-console
  console.log(`Organization: ${organization.slug}`);
  // eslint-disable-next-line no-console
  console.log(`Users (password "${DEMO_PASSWORD}"):`);
  // eslint-disable-next-line no-console
  console.log(`  admin    -> ${admin.email}`);
  // eslint-disable-next-line no-console
  console.log(`  agent    -> ${agent.email}`);
  // eslint-disable-next-line no-console
  console.log(`  customer -> ${customer.email}`);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
