import IORedis from 'ioredis';
import config from '../config';
import { logger } from '../middleware/logger';

const redis = new IORedis(config.redis.url, {
  password: config.redis.password,
});

interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string;
  rolloutPercentage?: number; // 0-100
  enabledFor?: string[]; // User IDs or other identifiers
  metadata?: Record<string, any>;
}

export class FeatureFlagService {
  private cachePrefix = 'feature_flags:';
  private cacheTTL = 300; // 5 minutes

  async isEnabled(flagKey: string, userId?: string): Promise<boolean> {
    try {
      const flag = await this.getFlag(flagKey);

      if (!flag) {
        return false;
      }

      if (!flag.enabled) {
        return false;
      }

      // Check if explicitly enabled for this user
      if (userId && flag.enabledFor?.includes(userId)) {
        return true;
      }

      // Check rollout percentage
      if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
        return this.shouldEnableForRollout(flagKey, userId, flag.rolloutPercentage);
      }

      return true;
    } catch (error) {
      logger.error('Feature flag check failed', { error, flagKey, userId });
      return false; // Fail closed
    }
  }

  async getFlag(flagKey: string): Promise<FeatureFlag | null> {
    try {
      // Check cache first
      const cached = await redis.get(`${this.cachePrefix}${flagKey}`);
      if (cached) {
        return JSON.parse(cached);
      }

      // In production, this would fetch from database
      // For now, return default flags
      const defaultFlags = this.getDefaultFlags();
      const flag = defaultFlags[flagKey];

      if (flag) {
        // Cache the flag
        await redis.setex(
          `${this.cachePrefix}${flagKey}`,
          this.cacheTTL,
          JSON.stringify(flag)
        );
      }

      return flag || null;
    } catch (error) {
      logger.error('Failed to get feature flag', { error, flagKey });
      return null;
    }
  }

  async setFlag(flag: FeatureFlag): Promise<void> {
    try {
      // Store in Redis
      await redis.setex(
        `${this.cachePrefix}${flag.key}`,
        this.cacheTTL,
        JSON.stringify(flag)
      );

      logger.info('Feature flag updated', { flag: flag.key, enabled: flag.enabled });
    } catch (error) {
      logger.error('Failed to set feature flag', { error, flag });
      throw error;
    }
  }

  async getAllFlags(): Promise<Record<string, FeatureFlag>> {
    try {
      const keys = await redis.keys(`${this.cachePrefix}*`);
      const flags: Record<string, FeatureFlag> = {};

      for (const key of keys) {
        const flagKey = key.replace(this.cachePrefix, '');
        const flag = await this.getFlag(flagKey);
        if (flag) {
          flags[flagKey] = flag;
        }
      }

      // Merge with default flags
      return { ...this.getDefaultFlags(), ...flags };
    } catch (error) {
      logger.error('Failed to get all feature flags', { error });
      return this.getDefaultFlags();
    }
  }

  async invalidateCache(flagKey?: string): Promise<void> {
    try {
      if (flagKey) {
        await redis.del(`${this.cachePrefix}${flagKey}`);
      } else {
        const keys = await redis.keys(`${this.cachePrefix}*`);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      }

      logger.info('Feature flag cache invalidated', { flagKey });
    } catch (error) {
      logger.error('Failed to invalidate feature flag cache', { error, flagKey });
    }
  }

  private shouldEnableForRollout(
    flagKey: string,
    userId: string | undefined,
    percentage: number
  ): boolean {
    if (!userId) {
      return false;
    }

    // Consistent hashing to ensure same user always gets same result
    const hash = this.hashString(`${flagKey}:${userId}`);
    const bucket = hash % 100;

    return bucket < percentage;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  private getDefaultFlags(): Record<string, FeatureFlag> {
    return {
      ai_recommendations: {
        key: 'ai_recommendations',
        enabled: config.features.aiRecommendations,
        description: 'Enable AI-powered menu recommendations',
        rolloutPercentage: 100,
      },
      sms_notifications: {
        key: 'sms_notifications',
        enabled: config.features.smsNotifications,
        description: 'Enable SMS notifications via Twilio',
        rolloutPercentage: 100,
      },
      email_notifications: {
        key: 'email_notifications',
        enabled: config.features.emailNotifications,
        description: 'Enable email notifications',
        rolloutPercentage: 100,
      },
      multi_tenant: {
        key: 'multi_tenant',
        enabled: config.features.multiTenant,
        description: 'Enable multi-tenant support',
        rolloutPercentage: 0,
      },
      advanced_analytics: {
        key: 'advanced_analytics',
        enabled: true,
        description: 'Enable advanced analytics dashboard',
        rolloutPercentage: 100,
      },
      table_management: {
        key: 'table_management',
        enabled: false,
        description: 'Enable table/seat management',
        rolloutPercentage: 0,
      },
      loyalty_program: {
        key: 'loyalty_program',
        enabled: true,
        description: 'Enable customer loyalty program',
        rolloutPercentage: 100,
      },
      voice_ordering: {
        key: 'voice_ordering',
        enabled: false,
        description: 'Enable voice-based ordering',
        rolloutPercentage: 0,
      },
      ar_menu: {
        key: 'ar_menu',
        enabled: false,
        description: 'Enable AR menu preview',
        rolloutPercentage: 0,
      },
      offline_mode: {
        key: 'offline_mode',
        enabled: true,
        description: 'Enable offline order queuing',
        rolloutPercentage: 50,
      },
    };
  }
}

export const featureFlagService = new FeatureFlagService();

// Middleware to check feature flags
export const requireFeature = (flagKey: string) => {
  return async (req: any, res: any, next: any) => {
    const userId = req.user?.id;
    const enabled = await featureFlagService.isEnabled(flagKey, userId);

    if (!enabled) {
      return res.status(403).json({
        success: false,
        error: 'Feature not available',
        feature: flagKey,
      });
    }

    next();
  };
};
