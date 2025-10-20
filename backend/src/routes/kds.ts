import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import { prisma, io } from '../index';
import { OrderStatus } from '@prisma/client';

const router = Router();

// Get KDS orders (kitchen display system)
router.get('/orders', authenticateToken, asyncHandler(async (req, res) => {
  const { status = 'PREPARING' } = req.query;

  const orders = await prisma.order.findMany({
    where: {
      status: (status as OrderStatus) || OrderStatus.PREPARING,
      channel: { in: ['IN_PERSON', 'ONLINE'] }
    },
    include: {
      orderItems: {
        include: {
          menuItem: true
        }
      },
      user: {
        select: {
          firstName: true,
          lastName: true
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  res.json({
    success: true,
    data: orders
  });
}));

// Update order status and broadcast to kitchen
router.patch('/orders/:id/status', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const order = await prisma.order.update({
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

  // Broadcast status update to kitchen
  io.to('kitchen').emit('order-status-update', {
    orderId: id,
    status,
    order
  });

  res.json({
    success: true,
    data: order
  });
}));

// Mark order as ready
router.post('/orders/:id/ready', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const order = await prisma.order.update({
    where: { id },
    data: { status: 'READY' },
    include: {
      orderItems: {
        include: {
          menuItem: true
        }
      }
    }
  });

  // Broadcast ready notification
  io.to('kitchen').emit('order-ready', {
    orderId: id,
    order
  });

  res.json({
    success: true,
    data: order
  });
}));

// Get kitchen statistics
router.get('/stats', authenticateToken, asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    pendingOrders,
    preparingOrders,
    readyOrders,
    completedToday,
    avgPrepTime
  ] = await Promise.all([
    prisma.order.count({
      where: { status: 'PENDING' }
    }),
    prisma.order.count({
      where: { status: 'PREPARING' }
    }),
    prisma.order.count({
      where: { status: 'READY' }
    }),
    prisma.order.count({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: today }
      }
    }),
    prisma.order.aggregate({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: today }
      },
      _avg: {
        // This would need a prepTime field in the schema
        // For now, we'll calculate based on createdAt and updatedAt
      }
    })
  ]);

  res.json({
    success: true,
    data: {
      pendingOrders,
      preparingOrders,
      readyOrders,
      completedToday,
      avgPrepTime: avgPrepTime._avg
    }
  });
}));

export default router;
