/**
 * Hand-rolled Prisma mock for e2e tests. Each test programs the return values
 * it needs; the app is exercised over real HTTP with the database boundary
 * stubbed, so we test routing, validation, guards and the response envelope
 * without provisioning a database.
 */
export interface PrismaMock {
  user: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  organization: { findUnique: jest.Mock };
  refreshToken: {
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  ticket: {
    count: jest.Mock;
    create: jest.Mock;
    findUnique: jest.Mock;
  };
  $transaction: jest.Mock;
}

export function createPrismaMock(): PrismaMock {
  return {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    organization: { findUnique: jest.fn() },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    ticket: {
      count: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}
