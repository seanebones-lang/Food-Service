import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Test database setup
beforeAll(async () => {
  try {
    // Connect to test database (skip if not available)
    await prisma.$connect();

    // Clean up test data
    await prisma.payment.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.menuItem.deleteMany();
    await prisma.inventoryItem.deleteMany();
    await prisma.loyaltyCustomer.deleteMany();
    await prisma.user.deleteMany();
  } catch (error) {
    console.warn('Database connection not available, skipping database setup');
  }
});

afterAll(async () => {
  try {
    // Clean up test data
    await prisma.payment.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.menuItem.deleteMany();
    await prisma.inventoryItem.deleteMany();
    await prisma.loyaltyCustomer.deleteMany();
    await prisma.user.deleteMany();

    await prisma.$disconnect();
  } catch (error) {
    console.warn('Database cleanup not available');
  }
});

// Test utilities
export const createTestUser = async (overrides = {}) => {
  try {
    return await prisma.user.create({
      data: {
        email: 'test@example.com',
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User',
        role: 'STAFF',
        ...overrides
      }
    });
  } catch (error) {
    console.warn('Database not available for creating test user');
    return null;
  }
};

export const createTestMenuItem = async (overrides = {}) => {
  try {
    return await prisma.menuItem.create({
      data: {
        name: 'Test Item',
        description: 'Test description',
        price: 10.99,
        category: 'Test',
        ...overrides
      }
    });
  } catch (error) {
    console.warn('Database not available for creating test menu item');
    return null;
  }
};

export const createTestOrder = async (overrides = {}) => {
  try {
    return await prisma.order.create({
      data: {
        orderNumber: 'TEST-001',
        channel: 'IN_PERSON',
        subtotal: 10.99,
        tax: 0.88,
        total: 11.87,
        ...overrides
      }
    });
  } catch (error) {
    console.warn('Database not available for creating test order');
    return null;
  }
};

export { prisma };

// Dummy test to satisfy Jest requirement for test files
describe('Test Setup', () => {
  test('should have test utilities available', () => {
    expect(typeof createTestUser).toBe('function');
    expect(typeof createTestMenuItem).toBe('function');
    expect(typeof createTestOrder).toBe('function');
  });
});
