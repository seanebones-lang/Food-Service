import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import config from '../config';
import { logger } from '../middleware/logger';
import { squareService } from './squareService.real';
import { twilioService } from './twilioService';
import { prisma } from '../index';

// Redis connection for BullMQ
const connection = new IORedis(config.redis.url, {
  maxRetriesPerRequest: null,
  password: config.redis.password,
});

// ==================== QUEUE DEFINITIONS ====================

export const QUEUES = {
  MENU_SYNC: 'menu-sync',
  INVENTORY_SYNC: 'inventory-sync',
  NOTIFICATIONS: 'notifications',
  ANALYTICS: 'analytics',
  REPORTS: 'reports',
} as const;

// ==================== QUEUE INSTANCES ====================

export const menuSyncQueue = new Queue(QUEUES.MENU_SYNC, { connection });
export const inventorySyncQueue = new Queue(QUEUES.INVENTORY_SYNC, { connection });
export const notificationsQueue = new Queue(QUEUES.NOTIFICATIONS, { connection });
export const analyticsQueue = new Queue(QUEUES.ANALYTICS, { connection });
export const reportsQueue = new Queue(QUEUES.REPORTS, { connection });

// ==================== JOB PROCESSORS ====================

// Menu Sync Worker
const menuSyncWorker = new Worker(
  QUEUES.MENU_SYNC,
  async (job: Job) => {
    logger.info('Processing menu sync job', { jobId: job.id });

    try {
      // Fetch menu items from Square
      const catalogItems = await squareService.syncMenuItems();

      let syncedCount = 0;
      let updatedCount = 0;

      for (const item of catalogItems) {
        if (item.type !== 'ITEM' || !item.itemData) continue;

        const itemData = item.itemData;
        const variation = itemData.variations?.[0];

        if (!variation?.itemVariationData?.priceMoney) continue;

        // Upsert menu item
        const existing = await prisma.menuItem.findUnique({
          where: { squareId: item.id },
        });

        const menuItemData = {
          name: itemData.name || 'Unnamed Item',
          description: itemData.description,
          price: Number(variation.itemVariationData.priceMoney.amount) / 100,
          category: itemData.categoryId || 'Uncategorized',
          isAvailable: !itemData.isDeleted,
          squareId: item.id,
          imageUrl: itemData.imageIds?.[0],
        };

        if (existing) {
          await prisma.menuItem.update({
            where: { id: existing.id },
            data: menuItemData,
          });
          updatedCount++;
        } else {
          await prisma.menuItem.create({
            data: menuItemData,
          });
          syncedCount++;
        }
      }

      logger.info('Menu sync completed', {
        synced: syncedCount,
        updated: updatedCount,
        total: catalogItems.length,
      });

      return { syncedCount, updatedCount };
    } catch (error) {
      logger.error('Menu sync failed', { error });
      throw error;
    }
  },
  { connection }
);

// Inventory Sync Worker
const inventorySyncWorker = new Worker(
  QUEUES.INVENTORY_SYNC,
  async (job: Job) => {
    logger.info('Processing inventory sync job', { jobId: job.id });

    try {
      const counts = await squareService.syncInventory(config.square.locationId);

      let syncedCount = 0;

      for (const count of counts) {
        const inventoryItem = await prisma.inventoryItem.findUnique({
          where: { squareId: count.catalogObjectId },
        });

        if (inventoryItem) {
          const newStock = parseInt(count.quantity || '0', 10);

          await prisma.inventoryItem.update({
            where: { id: inventoryItem.id },
            data: { currentStock: newStock },
          });

          // Check if low stock alert needed
          if (newStock <= inventoryItem.minStock) {
            await notificationsQueue.add('low-stock-alert', {
              inventoryItem: {
                name: inventoryItem.name,
                currentStock: newStock,
                minStock: inventoryItem.minStock,
                unit: inventoryItem.unit,
              },
            });
          }

          syncedCount++;
        }
      }

      logger.info('Inventory sync completed', { syncedCount });
      return { syncedCount };
    } catch (error) {
      logger.error('Inventory sync failed', { error });
      throw error;
    }
  },
  { connection }
);

// Notifications Worker
const notificationsWorker = new Worker(
  QUEUES.NOTIFICATIONS,
  async (job: Job) => {
    const { type, data } = job.data;

    logger.info('Processing notification', { type, jobId: job.id });

    try {
      switch (type) {
        case 'low-stock-alert':
          const managerPhone = process.env.MANAGER_PHONE;
          if (managerPhone && data.inventoryItem) {
            await twilioService.sendInventoryAlert(
              data.inventoryItem,
              managerPhone
            );
          }
          break;

        case 'order-notification':
          if (data.orderNumber && data.customerName && data.managerPhone) {
            await twilioService.sendOrderNotification(
              data.orderNumber,
              data.customerName,
              data.managerPhone
            );
          }
          break;

        case 'payment-alert':
          if (data.amount && data.orderNumber && data.managerPhone) {
            await twilioService.sendPaymentAlert(
              data.amount,
              data.orderNumber,
              data.managerPhone
            );
          }
          break;

        default:
          logger.warn('Unknown notification type', { type });
      }

      return { success: true };
    } catch (error) {
      logger.error('Notification failed', { error, type });
      throw error;
    }
  },
  { connection }
);

// Analytics Worker
const analyticsWorker = new Worker(
  QUEUES.ANALYTICS,
  async (job: Job) => {
    logger.info('Processing analytics job', { jobId: job.id });

    try {
      const { startDate, endDate } = job.data;

      // Calculate daily sales
      const orders = await prisma.order.findMany({
        where: {
          createdAt: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
          status: { in: ['COMPLETED'] },
        },
        include: {
          orderItems: {
            include: {
              menuItem: true,
            },
          },
        },
      });

      const totalRevenue = orders.reduce(
        (sum, order) => sum + Number(order.total),
        0
      );

      const topItems = orders
        .flatMap((o) => o.orderItems)
        .reduce((acc, item) => {
          const name = item.menuItem.name;
          acc[name] = (acc[name] || 0) + item.quantity;
          return acc;
        }, {} as Record<string, number>);

      logger.info('Analytics completed', {
        totalOrders: orders.length,
        totalRevenue,
        topItems: Object.keys(topItems).slice(0, 5),
      });

      return { totalOrders: orders.length, totalRevenue, topItems };
    } catch (error) {
      logger.error('Analytics processing failed', { error });
      throw error;
    }
  },
  { connection }
);

// ==================== SCHEDULED JOBS ====================

export const scheduleRecurringJobs = async () => {
  // Menu sync every 15 minutes
  await menuSyncQueue.add(
    'sync-menu',
    {},
    {
      repeat: {
        pattern: '*/15 * * * *', // Every 15 minutes
      },
      removeOnComplete: true,
      removeOnFail: false,
    }
  );

  // Inventory sync every 30 minutes
  await inventorySyncQueue.add(
    'sync-inventory',
    {},
    {
      repeat: {
        pattern: '*/30 * * * *', // Every 30 minutes
      },
      removeOnComplete: true,
      removeOnFail: false,
    }
  );

  // Daily analytics at midnight
  await analyticsQueue.add(
    'daily-analytics',
    {
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      endDate: new Date(),
    },
    {
      repeat: {
        pattern: '0 0 * * *', // Daily at midnight
      },
      removeOnComplete: 10,
      removeOnFail: false,
    }
  );

  logger.info('Recurring jobs scheduled');
};

// ==================== GRACEFUL SHUTDOWN ====================

export const shutdownQueues = async () => {
  logger.info('Shutting down job queues...');

  await menuSyncWorker.close();
  await inventorySyncWorker.close();
  await notificationsWorker.close();
  await analyticsWorker.close();

  await menuSyncQueue.close();
  await inventorySyncQueue.close();
  await notificationsQueue.close();
  await analyticsQueue.close();
  await reportsQueue.close();

  await connection.quit();

  logger.info('Job queues shut down successfully');
};

// ==================== QUEUE MONITORING ====================

export const getQueueStats = async () => {
  const queues = [
    menuSyncQueue,
    inventorySyncQueue,
    notificationsQueue,
    analyticsQueue,
    reportsQueue,
  ];

  const stats = await Promise.all(
    queues.map(async (queue) => {
      const [waiting, active, completed, failed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
      ]);

      return {
        name: queue.name,
        waiting,
        active,
        completed,
        failed,
      };
    })
  );

  return stats;
};
