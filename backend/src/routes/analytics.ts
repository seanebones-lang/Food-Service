import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import { authenticate, requireRole } from '../middleware/auth';
import { z } from 'zod';

/**
 * Advanced Analytics API Routes
 *
 * Provides comprehensive business intelligence endpoints:
 * - Revenue analytics
 * - Customer insights
 * - Product performance
 * - Staff productivity
 * - Predictive forecasting
 */

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/analytics/dashboard
 * Comprehensive dashboard analytics
 */
router.get('/dashboard', async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    // Revenue metrics
    const revenueData = await prisma.order.aggregate({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ['COMPLETED', 'READY'] },
      },
      _sum: { total: true },
      _count: true,
      _avg: { total: true },
    });

    // Order count by status
    const ordersByStatus = await prisma.order.groupBy({
      by: ['status'],
      where: {
        createdAt: { gte: start, lte: end },
      },
      _count: true,
    });

    // Order count by channel
    const ordersByChannel = await prisma.order.groupBy({
      by: ['channel'],
      where: {
        createdAt: { gte: start, lte: end },
      },
      _count: true,
    });

    // Daily revenue trend
    const dailyRevenue = await prisma.$queryRaw`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as orders,
        SUM(total) as revenue
      FROM orders
      WHERE created_at >= ${start} AND created_at <= ${end}
        AND status IN ('COMPLETED', 'READY')
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    // Top selling items
    const topItems = await prisma.$queryRaw`
      SELECT
        oi.name,
        oi.category,
        COUNT(*) as order_count,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.quantity * oi.price) as total_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.created_at >= ${start} AND o.created_at <= ${end}
        AND o.status IN ('COMPLETED', 'READY')
      GROUP BY oi.name, oi.category
      ORDER BY total_revenue DESC
      LIMIT 10
    `;

    // Unique customers
    const uniqueCustomers = await prisma.order.groupBy({
      by: ['customerEmail'],
      where: {
        createdAt: { gte: start, lte: end },
        customerEmail: { not: null },
      },
      _count: true,
    });

    res.json({
      summary: {
        totalRevenue: revenueData._sum.total || 0,
        totalOrders: revenueData._count,
        averageOrderValue: revenueData._avg.total || 0,
        uniqueCustomers: uniqueCustomers.length,
      },
      ordersByStatus,
      ordersByChannel,
      dailyRevenue,
      topItems,
    });
  } catch (error) {
    console.error('Analytics dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

/**
 * GET /api/analytics/revenue
 * Detailed revenue analytics
 */
router.get('/revenue', async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    let dateFormat;
    switch (groupBy) {
      case 'hour':
        dateFormat = `DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00')`;
        break;
      case 'week':
        dateFormat = `DATE_FORMAT(created_at, '%Y-%u')`;
        break;
      case 'month':
        dateFormat = `DATE_FORMAT(created_at, '%Y-%m')`;
        break;
      default:
        dateFormat = `DATE(created_at)`;
    }

    const revenue = await prisma.$queryRawUnsafe(`
      SELECT
        ${dateFormat} as period,
        COUNT(*) as orders,
        SUM(total) as revenue,
        SUM(subtotal) as subtotal,
        SUM(tax) as tax,
        SUM(tip) as tips,
        AVG(total) as avg_order_value
      FROM orders
      WHERE created_at >= ? AND created_at <= ?
        AND status IN ('COMPLETED', 'READY')
      GROUP BY period
      ORDER BY period ASC
    `, start, end);

    res.json({ revenue });
  } catch (error) {
    console.error('Revenue analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch revenue analytics' });
  }
});

/**
 * GET /api/analytics/customers
 * Customer insights and segmentation
 */
router.get('/customers', async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    // Customer lifetime value
    const customerLTV = await prisma.$queryRaw`
      SELECT
        customer_email,
        customer_name,
        COUNT(*) as order_count,
        SUM(total) as lifetime_value,
        AVG(total) as avg_order_value,
        MIN(created_at) as first_order,
        MAX(created_at) as last_order
      FROM orders
      WHERE created_at >= ${start} AND created_at <= ${end}
        AND customer_email IS NOT NULL
        AND status IN ('COMPLETED', 'READY')
      GROUP BY customer_email, customer_name
      ORDER BY lifetime_value DESC
      LIMIT 100
    `;

    // Customer segmentation
    const segments = await prisma.$queryRaw`
      SELECT
        CASE
          WHEN order_count >= 10 THEN 'VIP'
          WHEN order_count >= 5 THEN 'Loyal'
          WHEN order_count >= 2 THEN 'Regular'
          ELSE 'New'
        END as segment,
        COUNT(*) as customer_count,
        SUM(total_spent) as segment_revenue
      FROM (
        SELECT
          customer_email,
          COUNT(*) as order_count,
          SUM(total) as total_spent
        FROM orders
        WHERE created_at >= ${start} AND created_at <= ${end}
          AND customer_email IS NOT NULL
          AND status IN ('COMPLETED', 'READY')
        GROUP BY customer_email
      ) customer_stats
      GROUP BY segment
    `;

    // Repeat customer rate
    const repeatCustomers = await prisma.$queryRaw`
      SELECT
        COUNT(CASE WHEN order_count > 1 THEN 1 END) as repeat_customers,
        COUNT(*) as total_customers,
        ROUND(COUNT(CASE WHEN order_count > 1 THEN 1 END) * 100.0 / COUNT(*), 2) as repeat_rate
      FROM (
        SELECT customer_email, COUNT(*) as order_count
        FROM orders
        WHERE created_at >= ${start} AND created_at <= ${end}
          AND customer_email IS NOT NULL
        GROUP BY customer_email
      ) customer_orders
    `;

    res.json({
      topCustomers: customerLTV,
      segments,
      repeatRate: repeatCustomers[0],
    });
  } catch (error) {
    console.error('Customer analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch customer analytics' });
  }
});

/**
 * GET /api/analytics/products
 * Product performance analytics
 */
router.get('/products', async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, category } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    // Product performance
    const products = await prisma.$queryRawUnsafe(`
      SELECT
        oi.name,
        oi.category,
        COUNT(DISTINCT o.id) as order_count,
        SUM(oi.quantity) as total_sold,
        SUM(oi.quantity * oi.price) as revenue,
        AVG(oi.price) as avg_price
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.created_at >= ? AND o.created_at <= ?
        AND o.status IN ('COMPLETED', 'READY')
        ${category ? 'AND oi.category = ?' : ''}
      GROUP BY oi.name, oi.category
      ORDER BY revenue DESC
    `, start, end, ...(category ? [category] : []));

    // Category performance
    const categories = await prisma.$queryRaw`
      SELECT
        oi.category,
        COUNT(DISTINCT oi.name) as product_count,
        SUM(oi.quantity) as total_sold,
        SUM(oi.quantity * oi.price) as revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.created_at >= ${start} AND o.created_at <= ${end}
        AND o.status IN ('COMPLETED', 'READY')
      GROUP BY oi.category
      ORDER BY revenue DESC
    `;

    // Product combinations (items ordered together)
    const combinations = await prisma.$queryRaw`
      SELECT
        a.name as product_a,
        b.name as product_b,
        COUNT(*) as times_ordered_together
      FROM order_items a
      JOIN order_items b ON a.order_id = b.order_id AND a.id < b.id
      JOIN orders o ON a.order_id = o.id
      WHERE o.created_at >= ${start} AND o.created_at <= ${end}
        AND o.status IN ('COMPLETED', 'READY')
      GROUP BY a.name, b.name
      ORDER BY times_ordered_together DESC
      LIMIT 20
    `;

    res.json({
      products,
      categories,
      combinations,
    });
  } catch (error) {
    console.error('Product analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch product analytics' });
  }
});

/**
 * GET /api/analytics/staff
 * Staff productivity analytics
 */
router.get('/staff', requireRole(['ADMIN', 'MANAGER']), async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    // Orders processed by staff
    const staffPerformance = await prisma.$queryRaw`
      SELECT
        u.name as staff_name,
        u.email as staff_email,
        COUNT(DISTINCT o.id) as orders_processed,
        SUM(o.total) as total_sales,
        AVG(o.total) as avg_order_value,
        AVG(TIMESTAMPDIFF(MINUTE, o.created_at, o.updated_at)) as avg_processing_time
      FROM orders o
      JOIN users u ON o.created_by_id = u.id
      WHERE o.created_at >= ${start} AND o.created_at <= ${end}
      GROUP BY u.id, u.name, u.email
      ORDER BY total_sales DESC
    `;

    res.json({ staffPerformance });
  } catch (error) {
    console.error('Staff analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch staff analytics' });
  }
});

/**
 * GET /api/analytics/forecast
 * Predictive analytics and forecasting
 */
router.get('/forecast', requireRole(['ADMIN', 'MANAGER']), async (req: Request, res: Response): Promise<void> => {
  try {
    const { metric = 'revenue', period = 'day' } = req.query;

    // Get historical data (last 90 days)
    const historicalData = await prisma.$queryRaw`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as orders,
        SUM(total) as revenue
      FROM orders
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
        AND status IN ('COMPLETED', 'READY')
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    // Simple moving average forecast (7-day)
    const forecast = calculateMovingAverage(historicalData as any[], 7, metric as string);

    // Peak hours analysis
    const peakHours = await prisma.$queryRaw`
      SELECT
        HOUR(created_at) as hour,
        COUNT(*) as order_count,
        AVG(total) as avg_order_value
      FROM orders
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        AND status IN ('COMPLETED', 'READY')
      GROUP BY HOUR(created_at)
      ORDER BY order_count DESC
    `;

    res.json({
      historical: historicalData,
      forecast,
      peakHours,
    });
  } catch (error) {
    console.error('Forecast analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch forecast' });
  }
});

/**
 * GET /api/analytics/export
 * Export analytics data to CSV
 */
router.get('/export', async (req: Request, res: Response): Promise<void> => {
  try {
    const { type = 'orders', startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    let data;
    let headers;

    switch (type) {
      case 'orders':
        data = await prisma.order.findMany({
          where: {
            createdAt: { gte: start, lte: end },
          },
          include: {
            items: true,
          },
        });
        headers = ['Order Number', 'Date', 'Customer', 'Channel', 'Status', 'Total', 'Payment Method'];
        break;

      case 'revenue':
        data = await prisma.$queryRaw`
          SELECT
            DATE(created_at) as date,
            COUNT(*) as orders,
            SUM(total) as revenue
          FROM orders
          WHERE created_at >= ${start} AND created_at <= ${end}
          GROUP BY DATE(created_at)
        `;
        headers = ['Date', 'Orders', 'Revenue'];
        break;

      default:
        res.status(400).json({ error: 'Invalid export type' });
        return;
    }

    // Convert to CSV
    const csv = convertToCSV(data, headers);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="analytics-${type}-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// Helper functions

function calculateMovingAverage(data: any[], window: number, metric: string): any[] {
  const forecast = [];

  for (let i = window; i < data.length; i++) {
    const slice = data.slice(i - window, i);
    const avg = slice.reduce((sum, item) => sum + parseFloat(item[metric] || 0), 0) / window;

    forecast.push({
      date: data[i].date,
      actual: parseFloat(data[i][metric] || 0),
      forecast: avg,
    });
  }

  // Project 7 days into future
  const lastWindow = data.slice(-window);
  const futureAvg = lastWindow.reduce((sum, item) => sum + parseFloat(item[metric] || 0), 0) / window;

  for (let i = 1; i <= 7; i++) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + i);
    forecast.push({
      date: futureDate.toISOString().split('T')[0],
      forecast: futureAvg,
    });
  }

  return forecast;
}

function convertToCSV(data: any[], headers: string[]): string {
  let csv = headers.join(',') + '\n';

  data.forEach((row) => {
    const values = headers.map((header) => {
      const key = header.toLowerCase().replace(/ /g, '_');
      return `"${row[key] || ''}"`;
    });
    csv += values.join(',') + '\n';
  });

  return csv;
}

export default router;
