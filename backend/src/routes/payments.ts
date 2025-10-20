import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import { prisma } from '../index';
import { squareService } from '../services/squareService';
import { twilioService } from '../services/twilioService';
import { PaymentStatus, PaymentMethod } from '@prisma/client';

const router = Router();

// Get all payments
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const { status, method, limit = 50, offset = 0 } = req.query;

  const where: { status?: PaymentStatus; method?: PaymentMethod } = {};
  if (status && typeof status === 'string') where.status = status as PaymentStatus;
  if (method && typeof method === 'string') where.method = method as PaymentMethod;

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

  return res.json({
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

  return res.json({
    success: true,
    data: payment
  });
}));

// Process payment
router.post('/', asyncHandler(async (req, res) => {
  const { orderId, amount, method, transactionId, sourceId, idempotencyKey } = req.body;

  // Verify order exists
  const order = await prisma.order.findUnique({
    where: { id: orderId },
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

  let squarePaymentResult = null;
  let squarePaymentId = null;

  // Process payment through Square if sourceId is provided
  if (method === 'CARD' && sourceId && idempotencyKey) {
    try {
      squarePaymentResult = await squareService.createPayment({
        sourceId,
        amountMoney: {
          amount: Math.round(amount * 100), // Convert to cents
          currency: 'USD'
        },
        idempotencyKey,
        locationId: process.env.SQUARE_LOCATION_ID
      });

      // Update squarePaymentId with the actual payment ID
      squarePaymentId = squarePaymentResult.payment?.id;
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Payment processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Create payment record
  const payment = await prisma.payment.create({
    data: {
      orderId,
      amount: parseFloat(amount),
      method,
      squarePaymentId,
      transactionId,
      status: squarePaymentResult ? 'COMPLETED' : 'PENDING'
    }
  });

  // Update order status if fully paid
  const totalPaid = await prisma.payment.aggregate({
    where: { orderId },
    _sum: { amount: true }
  });

  if (totalPaid._sum.amount && Number(totalPaid._sum.amount) >= Number(order.total)) {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'CONFIRMED' }
    });

    // Send notification to manager
    const managerPhone = process.env.MANAGER_PHONE;
    if (managerPhone) {
      await twilioService.sendPaymentAlert(Number(amount), order.orderNumber, managerPhone);
    }
  }

  return res.status(201).json({
    success: true,
    data: {
      ...payment,
      squarePayment: squarePaymentResult
    }
  });
}));

// Process refund
router.post('/:id/refund', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { amount } = req.body;

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      order: true
    }
  });

  if (!payment) {
    return res.status(404).json({
      success: false,
      error: 'Payment not found'
    });
  }

  let squareRefundResult = null;

  // Process refund through Square if squarePaymentId exists
  if (payment.squarePaymentId) {
    try {
      squareRefundResult = await squareService.refundPayment(
        payment.squarePaymentId,
        {
          amount: Math.round(amount * 100), // Convert to cents
          currency: 'USD'
        }
      );
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Refund processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Create refund record
  const refund = await prisma.payment.create({
    data: {
      orderId: payment.orderId,
      amount: -parseFloat(amount), // Negative amount for refund
      method: payment.method,
      status: squareRefundResult ? 'REFUNDED' : 'PENDING',
      squarePaymentId: squareRefundResult?.refund?.id
    }
  });

  return res.status(201).json({
    success: true,
    data: {
      ...refund,
      squareRefund: squareRefundResult
    }
  });
}));

export default router;
