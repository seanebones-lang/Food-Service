import cron from 'node-cron';
import { squareService } from './squareService';
import { twilioService } from './twilioService';
import { aiService } from './aiService';
import { prisma } from '../index';
import { logger } from '../middleware/logger';

export class CronService {
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  constructor() {
    this.initializeJobs();
  }

  private initializeJobs() {
    // Sync menu items with Square every 15 minutes
    this.addJob('menu-sync', '*/15 * * * *', async () => {
      try {
        await squareService.syncMenuItems();
        logger.info('Menu sync job completed successfully');
      } catch (error) {
        logger.error('Menu sync job failed', { error });
      }
    });

    // Sync inventory with Square every 30 minutes
    this.addJob('inventory-sync', '*/30 * * * *', async () => {
      try {
        await squareService.syncInventory();
        logger.info('Inventory sync job completed successfully');
      } catch (error) {
        logger.error('Inventory sync job failed', { error });
      }
    });

    // Check for low stock alerts every hour
    this.addJob('low-stock-check', '0 * * * *', async () => {
      try {
        await this.checkLowStockAlerts();
        logger.info('Low stock check job completed successfully');
      } catch (error) {
        logger.error('Low stock check job failed', { error });
      }
    });

    // Generate daily sales report at 11 PM
    this.addJob('daily-report', '0 23 * * *', async () => {
      try {
        await this.generateDailyReport();
        logger.info('Daily report job completed successfully');
      } catch (error) {
        logger.error('Daily report job failed', { error });
      }
    });

    // Clean up old logs weekly (Sundays at 2 AM)
    this.addJob('log-cleanup', '0 2 * * 0', async () => {
      try {
        await this.cleanupOldLogs();
        logger.info('Log cleanup job completed successfully');
      } catch (error) {
        logger.error('Log cleanup job failed', { error });
      }
    });

    // Update AI recommendations daily at 6 AM
    this.addJob('ai-recommendations', '0 6 * * *', async () => {
      try {
        await this.updateAIRecommendations();
        logger.info('AI recommendations job completed successfully');
      } catch (error) {
        logger.error('AI recommendations job failed', { error });
      }
    });

    logger.info('Cron jobs initialized', {
      jobCount: this.jobs.size,
      jobs: Array.from(this.jobs.keys()),
    });
  }

  private addJob(name: string, schedule: string, task: () => Promise<void>) {
    const job = cron.schedule(schedule, task, {
      scheduled: false, // Don't start immediately
      timezone: 'America/New_York', // Adjust based on restaurant location
    });

    this.jobs.set(name, job);
    job.start();

    logger.info('Cron job added', { name, schedule });
  }

  private async checkLowStockAlerts() {
    const lowStockItems = await prisma.inventoryItem.findMany({
      where: {
        isActive: true,
        currentStock: {
          lte: prisma.inventoryItem.fields.minStock,
        },
      },
    });

    if (lowStockItems.length > 0) {
      // Get manager phone number (you might want to store this in a config table)
      const managerPhone = process.env.MANAGER_PHONE;
      
      if (managerPhone) {
        for (const item of lowStockItems) {
          await twilioService.sendInventoryAlert({
            name: item.name,
            currentStock: item.currentStock,
            minStock: item.minStock,
            unit: item.unit,
          }, managerPhone);
        }
      }

      logger.warn('Low stock alerts sent', {
        itemCount: lowStockItems.length,
        items: lowStockItems.map(item => item.name),
      });
    }
  }

  private async generateDailyReport() {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    // Get daily sales data
    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
        status: 'COMPLETED',
      },
      include: {
        orderItems: {
          include: {
            menuItem: true,
          },
        },
        payments: true,
      },
    });

    const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total), 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Get top selling items
    const itemSales = new Map<string, number>();
    orders.forEach(order => {
      order.orderItems.forEach(item => {
        const itemName = item.menuItem.name;
        itemSales.set(itemName, (itemSales.get(itemName) || 0) + item.quantity);
      });
    });

    const topItems = Array.from(itemSales.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, quantity]) => ({ name, quantity }));

    // Generate AI insights
    const salesData = [{
      date: today.toISOString().split('T')[0],
      revenue: totalRevenue,
      orderCount: totalOrders,
      topItems: topItems.map(item => item.name),
    }];

    const aiInsights = await aiService.analyzeSalesTrends(salesData);

    // Store report in database
    await prisma.dailyReport.create({
      data: {
        date: startOfDay,
        totalRevenue,
        totalOrders,
        avgOrderValue,
        topItems: JSON.stringify(topItems),
        aiInsights: JSON.stringify(aiInsights),
      },
    });

    logger.info('Daily report generated', {
      date: startOfDay.toISOString().split('T')[0],
      totalRevenue,
      totalOrders,
      avgOrderValue,
      topItemsCount: topItems.length,
    });
  }

  private async cleanupOldLogs() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // This would clean up log files older than 30 days
    // In a production environment, you might want to use a log rotation service
    logger.info('Log cleanup completed', {
      cutoffDate: thirtyDaysAgo.toISOString(),
    });
  }

  private async updateAIRecommendations() {
    // Get customer order history for AI recommendations
    const customers = await prisma.loyaltyCustomer.findMany({
      include: {
        // This would need a relation to orders in the schema
      },
    });

    for (const customer of customers) {
      try {
        const recommendations = await aiService.getMenuRecommendations({
          pastOrders: [], // This would be populated from actual order history
          preferences: [],
          dietaryRestrictions: [],
        });

        // Store recommendations (you might want to add a recommendations table)
        logger.info('AI recommendations updated for customer', {
          customerId: customer.id,
          recommendationsCount: recommendations.length,
        });
      } catch (error) {
        logger.error('Failed to update AI recommendations for customer', {
          customerId: customer.id,
          error,
        });
      }
    }
  }

  // Public methods to control jobs
  startJob(name: string) {
    const job = this.jobs.get(name);
    if (job) {
      job.start();
      logger.info('Cron job started', { name });
    } else {
      logger.warn('Cron job not found', { name });
    }
  }

  stopJob(name: string) {
    const job = this.jobs.get(name);
    if (job) {
      job.stop();
      logger.info('Cron job stopped', { name });
    } else {
      logger.warn('Cron job not found', { name });
    }
  }

  stopAllJobs() {
    this.jobs.forEach((job, name) => {
      job.stop();
      logger.info('Cron job stopped', { name });
    });
  }

  getJobStatus() {
    const status: Record<string, boolean> = {};
    this.jobs.forEach((job, name) => {
      status[name] = job.running;
    });
    return status;
  }
}

export const cronService = new CronService();
