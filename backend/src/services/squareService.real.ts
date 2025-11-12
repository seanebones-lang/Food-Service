import { Client, Environment, ApiError } from 'square';
import crypto from 'crypto';
import config from '../config';
import { logger } from '../middleware/logger';

export class SquareService {
  private client: Client;
  private locationId: string;
  private webhookSignatureKey: string;

  constructor() {
    // Initialize real Square SDK client
    this.client = new Client({
      accessToken: config.square.accessToken,
      environment: config.square.environment === 'production'
        ? Environment.Production
        : Environment.Sandbox,
    });

    this.locationId = config.square.locationId;
    this.webhookSignatureKey = config.square.webhookSignatureKey;

    logger.info('Square Service initialized', {
      environment: config.square.environment,
      hasAccessToken: !!config.square.accessToken,
      hasLocationId: !!this.locationId,
    });
  }

  // ==================== PAYMENTS API ====================

  async createPayment(paymentData: {
    sourceId: string;
    amountMoney: { amount: number; currency: string };
    idempotencyKey: string;
    locationId?: string;
    customerId?: string;
    note?: string;
  }) {
    try {
      const { paymentsApi } = this.client;

      const response = await paymentsApi.createPayment({
        sourceId: paymentData.sourceId,
        idempotencyKey: paymentData.idempotencyKey,
        amountMoney: {
          amount: BigInt(paymentData.amountMoney.amount),
          currency: paymentData.amountMoney.currency,
        },
        locationId: paymentData.locationId || this.locationId,
        customerId: paymentData.customerId,
        note: paymentData.note,
        autocomplete: true,
      });

      logger.info('Square payment created successfully', {
        paymentId: response.result.payment?.id,
        amount: paymentData.amountMoney.amount,
        status: response.result.payment?.status,
      });

      return response.result;
    } catch (error) {
      if (error instanceof ApiError) {
        logger.error('Square payment creation failed', {
          errors: error.errors,
          statusCode: error.statusCode,
        });
      }
      throw error;
    }
  }

  async getPayment(paymentId: string) {
    try {
      const { paymentsApi } = this.client;
      const response = await paymentsApi.getPayment(paymentId);

      return response.result.payment;
    } catch (error) {
      if (error instanceof ApiError) {
        logger.error('Failed to get Square payment', {
          paymentId,
          errors: error.errors,
        });
      }
      throw error;
    }
  }

  async refundPayment(
    paymentId: string,
    amountMoney: { amount: number; currency: string },
    idempotencyKey?: string,
    reason?: string
  ) {
    try {
      const { refundsApi } = this.client;

      const response = await refundsApi.refundPayment({
        idempotencyKey: idempotencyKey || `refund-${Date.now()}`,
        amountMoney: {
          amount: BigInt(amountMoney.amount),
          currency: amountMoney.currency,
        },
        paymentId,
        reason,
      });

      logger.info('Square refund processed', {
        refundId: response.result.refund?.id,
        paymentId,
        amount: amountMoney.amount,
      });

      return response.result;
    } catch (error) {
      if (error instanceof ApiError) {
        logger.error('Square refund failed', {
          paymentId,
          errors: error.errors,
        });
      }
      throw error;
    }
  }

  // ==================== ORDERS API ====================

  async createOrder(orderData: {
    locationId?: string;
    lineItems: Array<{
      name: string;
      quantity: string;
      basePriceMoney: { amount: number; currency: string };
      modifiers?: Array<{
        name: string;
        basePriceMoney: { amount: number; currency: string };
      }>;
      note?: string;
    }>;
    taxes?: Array<{
      name: string;
      percentage: string;
      scope: 'ORDER' | 'LINE_ITEM';
    }>;
    discounts?: Array<{
      name: string;
      percentage?: string;
      amountMoney?: { amount: number; currency: string };
      scope: 'ORDER' | 'LINE_ITEM';
    }>;
    customerId?: string;
  }) {
    try {
      const { ordersApi } = this.client;

      const lineItems = orderData.lineItems.map(item => ({
        name: item.name,
        quantity: item.quantity,
        basePriceMoney: {
          amount: BigInt(item.basePriceMoney.amount),
          currency: item.basePriceMoney.currency,
        },
        modifiers: item.modifiers?.map(mod => ({
          name: mod.name,
          basePriceMoney: {
            amount: BigInt(mod.basePriceMoney.amount),
            currency: mod.basePriceMoney.currency,
          },
        })),
        note: item.note,
      }));

      const response = await ordersApi.createOrder({
        order: {
          locationId: orderData.locationId || this.locationId,
          lineItems,
          taxes: orderData.taxes?.map(tax => ({
            name: tax.name,
            percentage: tax.percentage,
            scope: tax.scope,
          })),
          discounts: orderData.discounts?.map(disc => ({
            name: disc.name,
            percentage: disc.percentage,
            amountMoney: disc.amountMoney ? {
              amount: BigInt(disc.amountMoney.amount),
              currency: disc.amountMoney.currency,
            } : undefined,
            scope: disc.scope,
          })),
          customerId: orderData.customerId,
        },
        idempotencyKey: `order-${Date.now()}-${Math.random()}`,
      });

      logger.info('Square order created', {
        orderId: response.result.order?.id,
        itemsCount: lineItems.length,
      });

      return response.result;
    } catch (error) {
      if (error instanceof ApiError) {
        logger.error('Square order creation failed', {
          errors: error.errors,
        });
      }
      throw error;
    }
  }

  async updateOrder(
    orderId: string,
    updateData: {
      version?: number;
      state?: 'OPEN' | 'COMPLETED' | 'CANCELED';
    }
  ) {
    try {
      const { ordersApi } = this.client;

      const response = await ordersApi.updateOrder(orderId, {
        order: {
          version: updateData.version,
          state: updateData.state,
          locationId: this.locationId,
        },
      });

      logger.info('Square order updated', {
        orderId,
        state: updateData.state,
      });

      return response.result;
    } catch (error) {
      if (error instanceof ApiError) {
        logger.error('Square order update failed', {
          orderId,
          errors: error.errors,
        });
      }
      throw error;
    }
  }

  async getOrder(orderId: string) {
    try {
      const { ordersApi } = this.client;
      const response = await ordersApi.retrieveOrder(orderId);

      return response.result.order;
    } catch (error) {
      if (error instanceof ApiError) {
        logger.error('Failed to get Square order', {
          orderId,
          errors: error.errors,
        });
      }
      throw error;
    }
  }

  // ==================== CATALOG API ====================

  async syncMenuItems() {
    try {
      const { catalogApi } = this.client;

      const response = await catalogApi.listCatalog(
        undefined,
        'ITEM'
      );

      const items = response.result.objects || [];

      logger.info('Square catalog synced', {
        itemsCount: items.length,
      });

      return items;
    } catch (error) {
      if (error instanceof ApiError) {
        logger.error('Square catalog sync failed', {
          errors: error.errors,
        });
      }
      throw error;
    }
  }

  async getCatalogItem(itemId: string) {
    try {
      const { catalogApi } = this.client;

      const response = await catalogApi.retrieveCatalogObject(
        itemId,
        true
      );

      return response.result.object;
    } catch (error) {
      if (error instanceof ApiError) {
        logger.error('Failed to get catalog item', {
          itemId,
          errors: error.errors,
        });
      }
      throw error;
    }
  }

  async createCatalogItem(itemData: {
    name: string;
    description?: string;
    priceMoney: { amount: number; currency: string };
    category?: string;
  }) {
    try {
      const { catalogApi } = this.client;

      const response = await catalogApi.upsertCatalogObject({
        idempotencyKey: `catalog-${Date.now()}`,
        object: {
          type: 'ITEM',
          id: `#${itemData.name.replace(/\s+/g, '_')}`,
          itemData: {
            name: itemData.name,
            description: itemData.description,
            variations: [{
              type: 'ITEM_VARIATION',
              id: `#${itemData.name.replace(/\s+/g, '_')}_VAR`,
              itemVariationData: {
                itemId: `#${itemData.name.replace(/\s+/g, '_')}`,
                name: 'Regular',
                pricingType: 'FIXED_PRICING',
                priceMoney: {
                  amount: BigInt(itemData.priceMoney.amount),
                  currency: itemData.priceMoney.currency,
                },
              },
            }],
          },
        },
      });

      logger.info('Catalog item created', {
        itemId: response.result.catalogObject?.id,
        name: itemData.name,
      });

      return response.result.catalogObject;
    } catch (error) {
      if (error instanceof ApiError) {
        logger.error('Catalog item creation failed', {
          errors: error.errors,
        });
      }
      throw error;
    }
  }

  // ==================== INVENTORY API ====================

  async syncInventory(locationId?: string) {
    try {
      const { inventoryApi } = this.client;

      const response = await inventoryApi.batchRetrieveInventoryCounts({
        locationIds: [locationId || this.locationId],
      });

      const counts = response.result.counts || [];

      logger.info('Square inventory synced', {
        countsRetrieved: counts.length,
      });

      return counts;
    } catch (error) {
      if (error instanceof ApiError) {
        logger.error('Square inventory sync failed', {
          errors: error.errors,
        });
      }
      throw error;
    }
  }

  async updateInventory(
    catalogObjectId: string,
    locationId: string,
    quantity: number
  ) {
    try {
      const { inventoryApi } = this.client;

      const response = await inventoryApi.batchChangeInventory({
        idempotencyKey: `inventory-${Date.now()}`,
        changes: [{
          type: 'PHYSICAL_COUNT',
          physicalCount: {
            catalogObjectId,
            locationId: locationId || this.locationId,
            quantity: quantity.toString(),
            occurredAt: new Date().toISOString(),
            state: 'IN_STOCK',
          },
        }],
      });

      logger.info('Square inventory updated', {
        catalogObjectId,
        quantity,
      });

      return response.result;
    } catch (error) {
      if (error instanceof ApiError) {
        logger.error('Square inventory update failed', {
          catalogObjectId,
          errors: error.errors,
        });
      }
      throw error;
    }
  }

  // ==================== CUSTOMERS API ====================

  async createCustomer(customerData: {
    givenName?: string;
    familyName?: string;
    emailAddress?: string;
    phoneNumber?: string;
    note?: string;
  }) {
    try {
      const { customersApi } = this.client;

      const response = await customersApi.createCustomer({
        givenName: customerData.givenName,
        familyName: customerData.familyName,
        emailAddress: customerData.emailAddress,
        phoneNumber: customerData.phoneNumber,
        note: customerData.note,
        idempotencyKey: `customer-${Date.now()}`,
      });

      logger.info('Square customer created', {
        customerId: response.result.customer?.id,
      });

      return response.result.customer;
    } catch (error) {
      if (error instanceof ApiError) {
        logger.error('Square customer creation failed', {
          errors: error.errors,
        });
      }
      throw error;
    }
  }

  async getCustomer(customerId: string) {
    try {
      const { customersApi } = this.client;
      const response = await customersApi.retrieveCustomer(customerId);

      return response.result.customer;
    } catch (error) {
      if (error instanceof ApiError) {
        logger.error('Failed to get Square customer', {
          customerId,
          errors: error.errors,
        });
      }
      throw error;
    }
  }

  // ==================== LOCATIONS API ====================

  async getLocations() {
    try {
      const { locationsApi } = this.client;
      const response = await locationsApi.listLocations();

      logger.info('Square locations retrieved', {
        count: response.result.locations?.length || 0,
      });

      return response.result.locations || [];
    } catch (error) {
      if (error instanceof ApiError) {
        logger.error('Failed to get Square locations', {
          errors: error.errors,
        });
      }
      throw error;
    }
  }

  // ==================== WEBHOOKS ====================

  verifyWebhook(signature: string, body: string, url: string): boolean {
    try {
      if (!this.webhookSignatureKey) {
        logger.warn('Webhook signature key not configured, skipping verification');
        return true;
      }

      // Construct the notification URL + body string
      const stringToSign = url + body;

      // Generate HMAC-SHA256 hash
      const hmac = crypto
        .createHmac('sha256', this.webhookSignatureKey)
        .update(stringToSign, 'utf8')
        .digest('base64');

      const isValid = signature === hmac;

      if (!isValid) {
        logger.warn('Invalid webhook signature', {
          expected: hmac.substring(0, 10) + '...',
          received: signature.substring(0, 10) + '...',
        });
      }

      return isValid;
    } catch (error) {
      logger.error('Webhook verification failed', { error });
      return false;
    }
  }

  // ==================== UTILITY METHODS ====================

  async healthCheck(): Promise<boolean> {
    try {
      const locations = await this.getLocations();
      return locations.length > 0;
    } catch (error) {
      logger.error('Square health check failed', { error });
      return false;
    }
  }
}

export const squareService = new SquareService();
