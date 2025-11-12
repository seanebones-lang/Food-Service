import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Restaurant POS API',
      version: '2.1.0',
      description: 'Enterprise Restaurant Point of Sale System API',
      contact: {
        name: 'API Support',
        email: 'api@restaurant-pos.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server',
      },
      {
        url: 'https://api.restaurant-pos.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'string',
              example: 'Error message',
            },
            details: {
              type: 'array',
              items: {
                type: 'object',
              },
            },
          },
        },
        MenuItem: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'clx123abc',
            },
            name: {
              type: 'string',
              example: 'Margherita Pizza',
            },
            description: {
              type: 'string',
              example: 'Classic pizza with tomato sauce, mozzarella, and basil',
            },
            price: {
              type: 'number',
              format: 'float',
              example: 15.99,
            },
            category: {
              type: 'string',
              example: 'Pizza',
            },
            isAvailable: {
              type: 'boolean',
              example: true,
            },
            imageUrl: {
              type: 'string',
              nullable: true,
            },
            squareId: {
              type: 'string',
              nullable: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Order: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'clx123abc',
            },
            orderNumber: {
              type: 'string',
              example: 'ORD-001',
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'],
              example: 'PENDING',
            },
            channel: {
              type: 'string',
              enum: ['IN_PERSON', 'ONLINE', 'PHONE', 'QR_CODE'],
              example: 'IN_PERSON',
            },
            subtotal: {
              type: 'number',
              format: 'float',
              example: 31.98,
            },
            tax: {
              type: 'number',
              format: 'float',
              example: 2.56,
            },
            tip: {
              type: 'number',
              format: 'float',
              example: 5.00,
            },
            total: {
              type: 'number',
              format: 'float',
              example: 39.54,
            },
            customerName: {
              type: 'string',
              nullable: true,
              example: 'John Doe',
            },
            customerPhone: {
              type: 'string',
              nullable: true,
              example: '+1234567890',
            },
            customerEmail: {
              type: 'string',
              nullable: true,
              example: 'john@example.com',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Payment: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'clx123abc',
            },
            amount: {
              type: 'number',
              format: 'float',
              example: 39.54,
            },
            method: {
              type: 'string',
              enum: ['CASH', 'CARD', 'SQUARE', 'TOAST', 'CLOVER'],
              example: 'CARD',
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'],
              example: 'COMPLETED',
            },
            squarePaymentId: {
              type: 'string',
              nullable: true,
            },
            transactionId: {
              type: 'string',
              nullable: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Menu',
        description: 'Menu item management',
      },
      {
        name: 'Orders',
        description: 'Order management',
      },
      {
        name: 'Payments',
        description: 'Payment processing',
      },
      {
        name: 'Inventory',
        description: 'Inventory management',
      },
      {
        name: 'Auth',
        description: 'Authentication',
      },
      {
        name: 'System',
        description: 'System health and monitoring',
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/index.ts'],
};

const swaggerSpec = swaggerJsdoc(options);

export const setupSwagger = (app: Express) => {
  // Swagger UI
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Restaurant POS API Docs',
  }));

  // Swagger JSON
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  console.log('📚 Swagger documentation available at /api-docs');
};

export { swaggerSpec };
