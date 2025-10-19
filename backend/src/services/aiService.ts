import axios from 'axios';
import { logger } from '../middleware/logger';

export class AIService {
  private huggingFaceApiKey: string;
  private baseUrl: string;

  constructor() {
    this.huggingFaceApiKey = process.env.HUGGINGFACE_API_KEY || '';
    this.baseUrl = 'https://api-inference.huggingface.co/models';
  }

  async getMenuRecommendations(customerHistory: {
    pastOrders: Array<{ menuItemId: string; quantity: number; createdAt: Date }>;
    preferences?: string[];
    dietaryRestrictions?: string[];
  }): Promise<string[]> {
    try {
      if (!this.huggingFaceApiKey) {
        logger.warn('Hugging Face API key not configured, returning default recommendations');
        return this.getDefaultRecommendations();
      }

      // Prepare context for AI
      const context = this.buildRecommendationContext(customerHistory);
      
      const response = await axios.post(
        `${this.baseUrl}/microsoft/DialoGPT-medium`,
        {
          inputs: `Based on this customer's order history: ${context}, recommend 3 menu items they might like.`,
          parameters: {
            max_length: 100,
            temperature: 0.7,
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${this.huggingFaceApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      const recommendations = this.parseRecommendations(response.data);
      
      logger.info('AI recommendations generated', {
        customerOrders: customerHistory.pastOrders.length,
        recommendationsCount: recommendations.length,
      });

      return recommendations;
    } catch (error) {
      logger.error('AI recommendation failed', { error });
      return this.getDefaultRecommendations();
    }
  }

  private buildRecommendationContext(customerHistory: any): string {
    const orderSummary = customerHistory.pastOrders
      .slice(-5) // Last 5 orders
      .map((order: any) => order.menuItemId)
      .join(', ');

    const preferences = customerHistory.preferences?.join(', ') || '';
    const restrictions = customerHistory.dietaryRestrictions?.join(', ') || '';

    return `Orders: ${orderSummary}. Preferences: ${preferences}. Restrictions: ${restrictions}`;
  }

  private parseRecommendations(aiResponse: any): string[] {
    try {
      // Parse AI response and extract menu item names
      // This is a simplified parser - in production, you'd want more sophisticated parsing
      const text = aiResponse[0]?.generated_text || '';
      const recommendations = text
        .split(/[.,!?]/)
        .filter((item: string) => item.trim().length > 0)
        .slice(0, 3)
        .map((item: string) => item.trim());

      return recommendations.length > 0 ? recommendations : this.getDefaultRecommendations();
    } catch (error) {
      logger.error('Failed to parse AI recommendations', { error });
      return this.getDefaultRecommendations();
    }
  }

  private getDefaultRecommendations(): string[] {
    return [
      'Margherita Pizza',
      'Caesar Salad',
      'Grilled Salmon'
    ];
  }

  async analyzeSalesTrends(salesData: Array<{
    date: string;
    revenue: number;
    orderCount: number;
    topItems: string[];
  }>): Promise<{
    trend: 'increasing' | 'decreasing' | 'stable';
    forecast: number;
    insights: string[];
  }> {
    try {
      // Simple trend analysis
      const recentData = salesData.slice(-7); // Last 7 days
      const olderData = salesData.slice(-14, -7); // Previous 7 days

      const recentAvg = recentData.reduce((sum, day) => sum + day.revenue, 0) / recentData.length;
      const olderAvg = olderData.reduce((sum, day) => sum + day.revenue, 0) / olderData.length;

      const trend = recentAvg > olderAvg * 1.1 ? 'increasing' :
                   recentAvg < olderAvg * 0.9 ? 'decreasing' : 'stable';

      const forecast = recentAvg * (trend === 'increasing' ? 1.1 : trend === 'decreasing' ? 0.9 : 1.0);

      const insights = this.generateInsights(salesData, trend);

      logger.info('Sales trend analysis completed', {
        trend,
        forecast,
        insightsCount: insights.length,
      });

      return { trend, forecast, insights };
    } catch (error) {
      logger.error('Sales trend analysis failed', { error });
      return {
        trend: 'stable',
        forecast: 0,
        insights: ['Unable to analyze trends at this time'],
      };
    }
  }

  private generateInsights(salesData: any[], trend: string): string[] {
    const insights: string[] = [];

    // Analyze top items
    const allItems = salesData.flatMap(day => day.topItems);
    const itemCounts = allItems.reduce((acc: any, item: string) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, {});

    const topItem = Object.keys(itemCounts).reduce((a, b) => 
      itemCounts[a] > itemCounts[b] ? a : b
    );

    insights.push(`${topItem} is your most popular item`);

    // Trend-based insights
    if (trend === 'increasing') {
      insights.push('Sales are trending upward - consider increasing inventory');
    } else if (trend === 'decreasing') {
      insights.push('Sales are declining - consider promotional offers');
    }

    // Time-based insights
    const avgOrderValue = salesData.reduce((sum, day) => 
      sum + (day.revenue / day.orderCount), 0) / salesData.length;
    
    insights.push(`Average order value: $${avgOrderValue.toFixed(2)}`);

    return insights;
  }

  async predictInventoryNeeds(inventoryData: Array<{
    itemName: string;
    currentStock: number;
    dailyUsage: number;
    leadTime: number;
  }>): Promise<Array<{
    itemName: string;
    recommendedOrder: number;
    urgency: 'low' | 'medium' | 'high';
    reason: string;
  }>> {
    try {
      const predictions = inventoryData.map(item => {
        const daysRemaining = item.currentStock / item.dailyUsage;
        const safetyStock = item.dailyUsage * item.leadTime * 1.5; // 1.5x safety factor
        
        let urgency: 'low' | 'medium' | 'high' = 'low';
        let reason = '';
        let recommendedOrder = 0;

        if (daysRemaining <= item.leadTime) {
          urgency = 'high';
          reason = 'Critical: Will run out before next delivery';
          recommendedOrder = Math.ceil(safetyStock - item.currentStock);
        } else if (daysRemaining <= item.leadTime * 2) {
          urgency = 'medium';
          reason = 'Low stock: Order soon to maintain safety levels';
          recommendedOrder = Math.ceil(safetyStock - item.currentStock);
        } else {
          urgency = 'low';
          reason = 'Stock levels adequate';
          recommendedOrder = 0;
        }

        return {
          itemName: item.itemName,
          recommendedOrder: Math.max(0, recommendedOrder),
          urgency,
          reason,
        };
      });

      logger.info('Inventory predictions generated', {
        itemsAnalyzed: inventoryData.length,
        highUrgency: predictions.filter(p => p.urgency === 'high').length,
      });

      return predictions;
    } catch (error) {
      logger.error('Inventory prediction failed', { error });
      return [];
    }
  }
}

export const aiService = new AIService();
