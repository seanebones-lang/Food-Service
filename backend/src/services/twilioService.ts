import twilio from 'twilio';
import { logger } from '../middleware/logger';

export class TwilioService {
  private client: twilio.Twilio;

  constructor() {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }

  async sendSMS(to: string, message: string): Promise<boolean> {
    try {
      const result = await this.client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: to,
      });

      logger.info('SMS sent successfully', {
        messageSid: result.sid,
        to: to,
        messageLength: message.length,
      });

      return true;
    } catch (error) {
      logger.error('SMS sending failed', { error, to, message });
      return false;
    }
  }

  async sendInventoryAlert(inventoryItem: {
    name: string;
    currentStock: number;
    minStock: number;
    unit: string;
  }, managerPhone: string): Promise<boolean> {
    const message = `🚨 LOW STOCK ALERT 🚨\n\n` +
      `Item: ${inventoryItem.name}\n` +
      `Current Stock: ${inventoryItem.currentStock} ${inventoryItem.unit}\n` +
      `Minimum Required: ${inventoryItem.minStock} ${inventoryItem.unit}\n\n` +
      `Please restock immediately to avoid running out.`;

    return await this.sendSMS(managerPhone, message);
  }

  async sendOrderNotification(orderNumber: string, customerName: string, managerPhone: string): Promise<boolean> {
    const message = `📱 NEW ORDER NOTIFICATION\n\n` +
      `Order #: ${orderNumber}\n` +
      `Customer: ${customerName}\n` +
      `Time: ${new Date().toLocaleString()}\n\n` +
      `Please check the kitchen display system for details.`;

    return await this.sendSMS(managerPhone, message);
  }

  async sendPaymentAlert(amount: number, orderNumber: string, managerPhone: string): Promise<boolean> {
    const message = `💳 PAYMENT PROCESSED\n\n` +
      `Amount: $${amount.toFixed(2)}\n` +
      `Order #: ${orderNumber}\n` +
      `Time: ${new Date().toLocaleString()}`;

    return await this.sendSMS(managerPhone, message);
  }
}

export const twilioService = new TwilioService();
