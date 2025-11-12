import { PrismaClient } from '@prisma/client';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/restaurant_pos_test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.PORT = '3001';

// Extend Jest timeout for integration tests
jest.setTimeout(30000);

// Create a global test database client
const prisma = new PrismaClient();

beforeAll(async () => {
  // Connect to test database
  await prisma.$connect();
});

afterAll(async () => {
  // Cleanup and disconnect
  await prisma.$disconnect();
});

export { prisma };
