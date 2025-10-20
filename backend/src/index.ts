import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import winston from 'winston';

// Import routes
import authRoutes from './routes/auth';
import menuRoutes from './routes/menu';
import orderRoutes from './routes/orders';
import paymentRoutes from './routes/payments';
import inventoryRoutes from './routes/inventory';
import kdsRoutes from './routes/kds';

// Import services
import { cronService } from './services/cronService';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/logger';

// Load environment variables
dotenv.config();

// Initialize Prisma client
export const prisma = new PrismaClient();

// Initialize Express app
const app = express();
const server = createServer(app);

// Initialize Socket.IO for KDS
export const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Configure Winston logger
const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'restaurant-pos-backend' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/kds', kdsRoutes);

// Square webhook endpoint
app.post('/webhooks/square', express.raw({ type: 'application/json' }), async (req, res): Promise<void> => {
  try {
    const signature = req.headers['x-square-signature'] as string;
    const body = req.body.toString();
    const url = req.url;

    // Verify webhook signature
    const { squareService } = await import('./services/squareService');
    if (!squareService.verifyWebhook(signature, body, url)) {
      res.status(401).json({ error: 'Invalid webhook signature' });
      return;
    }

    const event = JSON.parse(body);

    // Handle different webhook events
    switch (event.type) {
      case 'payment.updated':
        // Handle payment updates
        winstonLogger.info('Payment webhook received', { event });
        break;
      case 'order.updated':
        // Handle order updates
        winstonLogger.info('Order webhook received', { event });
        break;
      case 'inventory.count.updated':
        // Handle inventory updates
        winstonLogger.info('Inventory webhook received', { event });
        break;
      default:
        winstonLogger.info('Unknown webhook event', { event });
    }

    res.status(200).json({ received: true });
  } catch (error) {
    winstonLogger.error('Webhook processing failed', { error });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Socket.IO connection handling for KDS
io.on('connection', (socket) => {
  winstonLogger.info(`KDS client connected: ${socket.id}`);

  socket.on('join-kitchen', () => {
    socket.join('kitchen');
    winstonLogger.info(`Kitchen staff joined: ${socket.id}`);
  });

  socket.on('disconnect', () => {
    winstonLogger.info(`KDS client disconnected: ${socket.id}`);
  });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  winstonLogger.info('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  winstonLogger.info('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  winstonLogger.info(`🚀 Restaurant POS Backend running on port ${PORT}`);
  winstonLogger.info(`📊 Environment: ${process.env.NODE_ENV}`);
  winstonLogger.info(`🔗 Frontend URL: ${process.env.FRONTEND_URL}`);
  winstonLogger.info(`⏰ Cron jobs initialized: ${Object.keys(cronService.getJobStatus()).length} jobs`);
});

export default app;
