import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import { prisma, io } from '../index';
import { squareService } from '../services/squareService';
import { twilioService } from '../services/twilioService';
import { OrderStatus, OrderChannel } from '@prisma/client';

const router = Router();

// Get all orders
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const { status, channel, limit = 50, offset = 0 } = req.query;

  const where: { status?: OrderStatus; channel?: OrderChannel } = {};
  if (status && typeof status === 'string') where.status = status as OrderStatus;
  if (channel && typeof channel === 'string') where.channel = channel as OrderChannel;

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

  return res.json({
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
    notes,
    syncToSquare = true
  } = req.body;

  // Calculate totals
  let subtotal = 0;
  const processedOrderItems = [];
  
  for (const item of orderItems) {
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: item.menuItemId }
    });
    if (menuItem) {
      const itemTotal = Number(menuItem.price) * item.quantity;
      subtotal += itemTotal;
      processedOrderItems.push({
        ...item,
        price: Number(menuItem.price),
        total: itemTotal
      });
    }
  }

  const tax = subtotal * 0.08; // 8% tax rate
  const total = subtotal + tax;

  // Generate order number
  const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

  // Create order in database
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
        create: processedOrderItems.map((item: { quantity: number; price: number; modifiers?: string; notes?: string; menuItemId: string }) => ({
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

  // Sync to Square Orders API if requested
  let squareOrderResult = null;
  if (syncToSquare && process.env.SQUARE_LOCATION_ID) {
    try {
      const squareLineItems = processedOrderItems.map((item: { menuItem?: { name: string }; quantity: number; price: number; modifiers?: Array<{ name: string; price?: number }> }) => ({
        name: item.menuItem?.name || 'Unknown Item',
        quantity: item.quantity.toString(),
        basePriceMoney: {
          amount: Math.round(item.price * 100), // Convert to cents
          currency: 'USD'
        },
        modifiers: item.modifiers ? item.modifiers.map((mod: { name: string; price?: number }) => ({
          name: mod.name,
          basePriceMoney: {
            amount: Math.round((mod.price || 0) * 100),
            currency: 'USD'
          }
        })) : undefined
      }));

      squareOrderResult = await squareService.createOrder({
        locationId: process.env.SQUARE_LOCATION_ID || '',
        lineItems: squareLineItems,
        taxes: [{
          name: 'Sales Tax',
          percentage: '8.0',
          scope: 'ORDER'
        }]
      });

      // Update order with Square order ID
      await prisma.order.update({
        where: { id: order.id },
        data: { squareOrderId: squareOrderResult.order?.id }
      });

    } catch (error) {
      // Log error but don't fail the order creation
      console.error('Square order sync failed:', error);
    }
  }

  // Broadcast to kitchen display system
  io.to('kitchen').emit('new-order', {
    orderId: order.id,
    orderNumber: order.orderNumber,
    orderItems: order.orderItems,
    customerName,
    channel,
    createdAt: order.createdAt
  });

  // Send notification to manager for online orders
  if (channel === 'ONLINE' && customerName) {
    const managerPhone = process.env.MANAGER_PHONE;
    if (managerPhone) {
      await twilioService.sendOrderNotification(orderNumber, customerName, managerPhone);
    }
  }

  res.status(201).json({
    success: true,
    data: {
      ...order,
      squareOrder: squareOrderResult
    }
  });
}));

// Update order status
router.patch('/:id/status', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, syncToSquare = true } = req.body;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      orderItems: {
        include: {
          menuItem: true
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

  // Update order status in database
  const updatedOrder = await prisma.order.update({
    where: { id },
    data: { status },
    include: {
      orderItems: {
        include: {
          menuItem: true
        }
      }
    }
  });

  // Sync status to Square if order has Square ID
  if (syncToSquare && order.squareOrderId) {
    try {
      const squareState = mapOrderStatusToSquareState(status);
      await squareService.updateOrderStatus(order.squareOrderId, squareState);
    } catch (error) {
      console.error('Square status sync failed:', error);
    }
  }

  // Broadcast status update to kitchen
  io.to('kitchen').emit('order-status-update', {
    orderId: id,
    orderNumber: order.orderNumber,
    status,
    order: updatedOrder
  });

  return res.json({
    success: true,
    data: updatedOrder
  });
}));

// Helper function to map our order status to Square order state
function mapOrderStatusToSquareState(status: string): string {
  const statusMap: Record<string, string> = {
    'PENDING': 'OPEN',
    'CONFIRMED': 'OPEN',
    'PREPARING': 'OPEN',
    'READY': 'COMPLETED',
    'COMPLETED': 'COMPLETED',
    'CANCELLED': 'CANCELED'
  };
  
  return statusMap[status] || 'OPEN';
}

export default router;
