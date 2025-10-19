import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import { prisma } from '../index';

const router = Router();

// Get all payments
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const { status, method, limit = 50, offset = 0 } = req.query;

  const where: any = {};
  if (status) where.status = status;
  if (method) where.method = method;

  const payments = await prisma.payment.findMany({
    where,
    include: {
      order: {
        select: {
          orderNumber: true,
          customerName: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: parseInt(limit as string),
    skip: parseInt(offset as string)
  });

  res.json({
    success: true,
    data: payments
  });
}));

// Get payment by ID
router.get('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      order: {
        include: {
          orderItems: {
            include: {
              menuItem: true
            }
          }
        }
      }
    }
  });

  if (!payment) {
    return res.status(404).json({
      success: false,
      error: 'Payment not found'
    });
  }

  res.json({
    success: true,
    data: payment
  });
}));

// Process payment
router.post('/', asyncHandler(async (req, res) => {
  const { orderId, amount, method, squarePaymentId, transactionId } = req.body;

  // Verify order exists
  const order = await prisma.order.findUnique({
    where: { id: orderId }
  });

  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Order not found'
    });
  }

  // Create payment record
  const payment = await prisma.payment.create({
    data: {
      orderId,
      amount: parseFloat(amount),
      method,
      squarePaymentId,
      transactionId,
      status: 'COMPLETED'
    }
  });

  // Update order status if fully paid
  const totalPaid = await prisma.payment.aggregate({
    where: { orderId },
    _sum: { amount: true }
  });

  if (totalPaid._sum.amount && totalPaid._sum.amount >= Number(order.total)) {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'CONFIRMED' }
    });
  }

  res.status(201).json({
    success: true,
    data: payment
  });
}));

// Process refund
router.post('/:id/refund', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { amount, reason } = req.body;

  const payment = await prisma.payment.findUnique({
    where: { id }
  });

  if (!payment) {
    return res.status(404).json({
      success: false,
      error: 'Payment not found'
    });
  }

  // Create refund record
  const refund = await prisma.payment.create({
    data: {
      orderId: payment.orderId,
      amount: -parseFloat(amount), // Negative amount for refund
      method: payment.method,
      status: 'REFUNDED'
    }
  });

  res.status(201).json({
    success: true,
    data: refund
  });
}));

export default router;
