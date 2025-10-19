import { PrismaClient } from '@prisma/client';
import { createServer } from 'http';
import app from '../src/index';

const prisma = new PrismaClient();

// Test database setup
beforeAll(async () => {
  // Connect to test database
  await prisma.$connect();
  
  // Clean up test data
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.loyaltyCustomer.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  // Clean up test data
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.loyaltyCustomer.deleteMany();
  await prisma.user.deleteMany();
  
  await prisma.$disconnect();
});

// Test utilities
export const createTestUser = async (overrides = {}) => {
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
};

export const createTestMenuItem = async (overrides = {}) => {
  return await prisma.menuItem.create({
    data: {
      name: 'Test Item',
      description: 'Test description',
      price: 10.99,
      category: 'Test',
      ...overrides
    }
  });
};

export const createTestOrder = async (overrides = {}) => {
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
};

export { prisma };
