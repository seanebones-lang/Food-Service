import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import { prisma } from '../index';

const router = Router();

// Get all orders
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const { status, channel, limit = 50, offset = 0 } = req.query;

  const where: any = {};
  if (status) where.status = status;
  if (channel) where.channel = channel;

  const orders = await prisma.order.findMany({
    where,
    include: {
      orderItems: {
        include: {
          menuItem: true
        }
      },
      payments: true,
      user: {
        select: {
          firstName: true,
          lastName: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: parseInt(limit as string),
    skip: parseInt(offset as string)
  });

  res.json({
    success: true,
    data: orders
  });
}));

// Get order by ID
router.get('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      orderItems: {
        include: {
          menuItem: true
        }
      },
      payments: true,
      user: {
        select: {
          firstName: true,
          lastName: true
        }
      }
    }
  });

  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Order not found'
    });
  }

  res.json({
    success: true,
    data: order
  });
}));

// Create new order
router.post('/', asyncHandler(async (req, res) => {
  const {
    orderItems,
    customerName,
    customerPhone,
    customerEmail,
    channel = 'IN_PERSON',
    notes
  } = req.body;

  // Calculate totals
  let subtotal = 0;
  for (const item of orderItems) {
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: item.menuItemId }
    });
    if (menuItem) {
      subtotal += Number(menuItem.price) * item.quantity;
    }
  }

  const tax = subtotal * 0.08; // 8% tax rate
  const total = subtotal + tax;

  // Generate order number
  const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

  const order = await prisma.order.create({
    data: {
      orderNumber,
      channel,
      subtotal,
      tax,
      total,
      customerName,
      customerPhone,
      customerEmail,
      notes,
      orderItems: {
        create: orderItems.map((item: any) => ({
          quantity: item.quantity,
          price: item.price,
          modifiers: item.modifiers ? JSON.parse(item.modifiers) : null,
          notes: item.notes,
          menuItemId: item.menuItemId
        }))
      }
    },
    include: {
      orderItems: {
        include: {
          menuItem: true
        }
      }
    }
  });

  res.status(201).json({
    success: true,
    data: order
  });
}));

// Update order status
router.patch('/:id/status', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const order = await prisma.order.update({
    where: { id },
    data: { status }
  });

  res.json({
    success: true,
    data: order
  });
}));

export default router;
