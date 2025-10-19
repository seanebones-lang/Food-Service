import { Client, Environment } from 'squareup';
import { logger } from '../middleware/logger';

export class SquareService {
  private client: Client;
  private environment: Environment;

  constructor() {
    this.environment = process.env.SQUARE_ENVIRONMENT === 'production' 
      ? Environment.Production 
      : Environment.Sandbox;
    
    this.client = new Client({
      accessToken: process.env.SQUARE_ACCESS_TOKEN!,
      environment: this.environment,
    });
  }

  // Payments API
  async createPayment(paymentData: {
    sourceId: string;
    amountMoney: { amount: number; currency: string };
    idempotencyKey: string;
    locationId?: string;
  }) {
    try {
      const { paymentsApi } = this.client;
      
      const response = await paymentsApi.createPayment({
        sourceId: paymentData.sourceId,
        amountMoney: paymentData.amountMoney,
        idempotencyKey: paymentData.idempotencyKey,
        locationId: paymentData.locationId,
      });

      logger.info('Square payment created successfully', {
        paymentId: response.result.payment?.id,
        amount: paymentData.amountMoney.amount,
      });

      return response.result;
    } catch (error) {
      logger.error('Square payment creation failed', { error });
      throw error;
    }
  }

  async refundPayment(paymentId: string, amountMoney: { amount: number; currency: string }) {
    try {
      const { refundsApi } = this.client;
      
      const response = await refundsApi.refundPayment({
        paymentId,
        amountMoney,
        idempotencyKey: `refund_${paymentId}_${Date.now()}`,
      });

      logger.info('Square refund processed successfully', {
        refundId: response.result.refund?.id,
        paymentId,
      });

      return response.result;
    } catch (error) {
      logger.error('Square refund failed', { error, paymentId });
      throw error;
    }
  }

  // Orders API
  async createOrder(orderData: {
    locationId: string;
    lineItems: Array<{
      name: string;
      quantity: string;
      basePriceMoney: { amount: number; currency: string };
      modifiers?: Array<{
        name: string;
        basePriceMoney: { amount: number; currency: string };
      }>;
    }>;
    taxes?: Array<{
      name: string;
      percentage: string;
    }>;
  }) {
    try {
      const { ordersApi } = this.client;
      
      const response = await ordersApi.createOrder({
        locationId: orderData.locationId,
        order: {
          locationId: orderData.locationId,
          lineItems: orderData.lineItems,
          taxes: orderData.taxes,
        },
        idempotencyKey: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      });

      logger.info('Square order created successfully', {
        orderId: response.result.order?.id,
        locationId: orderData.locationId,
      });

      return response.result;
    } catch (error) {
      logger.error('Square order creation failed', { error });
      throw error;
    }
  }

  async updateOrderStatus(orderId: string, state: string) {
    try {
      const { ordersApi } = this.client;
      
      const response = await ordersApi.updateOrder({
        orderId,
        order: {
          state,
        },
      });

      logger.info('Square order status updated', {
        orderId,
        state,
      });

      return response.result;
    } catch (error) {
      logger.error('Square order update failed', { error, orderId });
      throw error;
    }
  }

  // Catalog API
  async getCatalogItems() {
    try {
      const { catalogApi } = this.client;
      
      const response = await catalogApi.listCatalog({
        types: 'ITEM',
      });

      logger.info('Square catalog items retrieved', {
        itemCount: response.result.objects?.length || 0,
      });

      return response.result.objects || [];
    } catch (error) {
      logger.error('Square catalog fetch failed', { error });
      throw error;
    }
  }

  async syncMenuItems() {
    try {
      const catalogItems = await this.getCatalogItems();
      const { prisma } = await import('../index');

      for (const item of catalogItems) {
        if (item.type === 'ITEM' && item.itemData) {
          const itemData = item.itemData;
          
          await prisma.menuItem.upsert({
            where: { squareId: item.id },
            update: {
              name: itemData.name || 'Unknown Item',
              description: itemData.description || null,
              price: itemData.variations?.[0]?.itemVariationData?.priceMoney?.amount 
                ? Number(itemData.variations[0].itemVariationData.priceMoney.amount) / 100 
                : 0,
              category: itemData.categoryId || 'Uncategorized',
              isAvailable: itemData.variations?.[0]?.itemVariationData?.trackInventory !== false,
            },
            create: {
              name: itemData.name || 'Unknown Item',
              description: itemData.description || null,
              price: itemData.variations?.[0]?.itemVariationData?.priceMoney?.amount 
                ? Number(itemData.variations[0].itemVariationData.priceMoney.amount) / 100 
                : 0,
              category: itemData.categoryId || 'Uncategorized',
              squareId: item.id,
              isAvailable: itemData.variations?.[0]?.itemVariationData?.trackInventory !== false,
            },
          });
        }
      }

      logger.info('Menu items synced with Square catalog', {
        syncedItems: catalogItems.length,
      });

      return catalogItems.length;
    } catch (error) {
      logger.error('Menu sync failed', { error });
      throw error;
    }
  }

  // Inventory API
  async getInventoryCounts() {
    try {
      const { inventoryApi } = this.client;
      
      const response = await inventoryApi.batchRetrieveInventoryCounts({
        catalogObjectIds: [], // Empty array gets all items
      });

      logger.info('Square inventory counts retrieved', {
        countCount: response.result.counts?.length || 0,
      });

      return response.result.counts || [];
    } catch (error) {
      logger.error('Square inventory fetch failed', { error });
      throw error;
    }
  }

  async syncInventory() {
    try {
      const inventoryCounts = await this.getInventoryCounts();
      const { prisma } = await import('../index');

      for (const count of inventoryCounts) {
        if (count.catalogObjectId) {
          // Find the corresponding inventory item
          const inventoryItem = await prisma.inventoryItem.findFirst({
            where: { squareId: count.catalogObjectId },
          });

          if (inventoryItem) {
            await prisma.inventoryItem.update({
              where: { id: inventoryItem.id },
              data: {
                currentStock: parseInt(count.quantity || '0'),
              },
            });
          }
        }
      }

      logger.info('Inventory synced with Square', {
        syncedCounts: inventoryCounts.length,
      });

      return inventoryCounts.length;
    } catch (error) {
      logger.error('Inventory sync failed', { error });
      throw error;
    }
  }

  // Locations API
  async getLocations() {
    try {
      const { locationsApi } = this.client;
      
      const response = await locationsApi.listLocations();

      logger.info('Square locations retrieved', {
        locationCount: response.result.locations?.length || 0,
      });

      return response.result.locations || [];
    } catch (error) {
      logger.error('Square locations fetch failed', { error });
      throw error;
    }
  }

  // Webhook verification
  verifyWebhook(signature: string, body: string, url: string): boolean {
    try {
      // Square webhook verification logic would go here
      // For now, we'll return true in development
      if (process.env.NODE_ENV === 'development') {
        return true;
      }
      
      // In production, implement proper webhook signature verification
      return true;
    } catch (error) {
      logger.error('Webhook verification failed', { error });
      return false;
    }
  }
}

export const squareService = new SquareService();
