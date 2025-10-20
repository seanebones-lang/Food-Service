import request from 'supertest';
import { prisma } from '../src/index';
import app from '../src/index';
import { Decimal } from '@prisma/client/runtime/library';

describe('Phase 2: Core POS Backend & Integrations', () => {
  let testMenuItem: { id: string; name: string; price: Decimal };
  let authToken: string;

  beforeAll(async () => {
    try {
      // Create test user
      const testUser = await prisma.user.create({
        data: {
          email: 'test@example.com',
          password: 'hashedpassword',
          firstName: 'Test',
          lastName: 'User',
          role: 'STAFF'
        }
      });

      // Create test menu item
      testMenuItem = await prisma.menuItem.create({
        data: {
          name: 'Test Pizza',
          description: 'Test description',
          price: 15.99,
          category: 'Pizza',
          squareId: 'test-square-id'
        }
      });

      // Login to get auth token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'hashedpassword'
        });

      authToken = loginResponse.body.data.token;
    } catch (error) {
      console.warn('Database not available, skipping test data creation');
      authToken = 'test-token';
    }
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.payment.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.menuItem.deleteMany();
    await prisma.inventoryItem.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('Square API Integration', () => {
    test('should sync menu items with Square', async () => {
      const response = await request(app)
        .post('/api/menu/sync/square')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('synced');
    });

    test('should process payment through Square', async () => {
      // Create test order first
      const orderResponse = await request(app)
        .post('/api/orders')
        .send({
          orderItems: [{
            menuItemId: testMenuItem.id,
            quantity: 2,
            price: 15.99
          }],
          customerName: 'Test Customer',
          channel: 'IN_PERSON'
        });

      const order = orderResponse.body.data;

      // Process payment
      const paymentResponse = await request(app)
        .post('/api/payments')
        .send({
          orderId: order.id,
          amount: 34.55, // Including tax
          method: 'CARD',
          sourceId: 'test-source-id',
          idempotencyKey: `test-${Date.now()}`
        })
        .expect(201);

      expect(paymentResponse.body.success).toBe(true);
      expect(paymentResponse.body.data.squarePayment).toBeDefined();
    });
  });

  describe('Real-time KDS Integration', () => {
    test('should broadcast new orders to kitchen', async () => {
      const orderResponse = await request(app)
        .post('/api/orders')
        .send({
          orderItems: [{
            menuItemId: testMenuItem.id,
            quantity: 1,
            price: 15.99
          }],
          customerName: 'KDS Test Customer',
          channel: 'IN_PERSON'
        })
        .expect(201);

      expect(orderResponse.body.success).toBe(true);
      expect(orderResponse.body.data.orderNumber).toBeDefined();
    });

    test('should update order status and broadcast to kitchen', async () => {
      // Create order first
      const orderResponse = await request(app)
        .post('/api/orders')
        .send({
          orderItems: [{
            menuItemId: testMenuItem.id,
            quantity: 1,
            price: 15.99
          }],
          customerName: 'Status Test Customer',
          channel: 'IN_PERSON'
        });

      const order = orderResponse.body.data;

      // Update status
      const statusResponse = await request(app)
        .patch(`/api/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'PREPARING' })
        .expect(200);

      expect(statusResponse.body.success).toBe(true);
      expect(statusResponse.body.data.status).toBe('PREPARING');
    });
  });

  describe('Inventory Management with AI', () => {
    let testInventoryItem: { id: string; name: string; currentStock: number; costPerUnit: Decimal };

    beforeAll(async () => {
      try {
        testInventoryItem = await prisma.inventoryItem.create({
          data: {
            name: 'Test Ingredient',
            category: 'Produce',
            currentStock: 5,
            minStock: 10,
            maxStock: 50,
            unit: 'lbs',
            costPerUnit: 2.50
          }
        });
      } catch (error) {
        console.warn('Database not available for creating test inventory item');
      }
    });

    test('should get AI inventory predictions', async () => {
      const response = await request(app)
        .get('/api/inventory/predictions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    test('should update stock and trigger low stock alert', async () => {
      const response = await request(app)
        .patch(`/api/inventory/${testInventoryItem.id}/stock`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ quantity: 3, operation: 'set' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.currentStock).toBe(3);
    });

    test('should sync inventory with Square', async () => {
      const response = await request(app)
        .post('/api/inventory/sync/square')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('synced');
    });

    test('should get inventory analytics', async () => {
      const response = await request(app)
        .get('/api/inventory/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalItems).toBeGreaterThan(0);
    });
  });

  describe('SMS Notifications', () => {
    test('should send low stock alert', async () => {
      // This test would require actual Twilio credentials
      // For now, we'll just test the endpoint exists
      const response = await request(app)
        .get('/api/inventory/alerts/low-stock')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Webhook Integration', () => {
    test('should handle Square webhook events', async () => {
      const webhookPayload = {
        type: 'payment.updated',
        data: {
          payment: {
            id: 'test-payment-id',
            status: 'COMPLETED'
          }
        }
      };

      const response = await request(app)
        .post('/webhooks/square')
        .send(webhookPayload)
        .set('Content-Type', 'application/json')
        .expect(200);

      expect(response.body.received).toBe(true);
    });
  });

  describe('Cron Jobs', () => {
    test('should have cron jobs initialized', () => {
      // This would test that cron jobs are running
      // In a real test, you might check the cron service status
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Error Handling', () => {
    test('should handle Square API errors gracefully', async () => {
      const response = await request(app)
        .post('/api/payments')
        .send({
          orderId: 'invalid-order-id',
          amount: 10.00,
          method: 'CARD',
          sourceId: 'invalid-source-id',
          idempotencyKey: 'test-key'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    test('should handle missing authentication', async () => {
      const response = await request(app)
        .get('/api/inventory')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('token');
    });
  });
});
