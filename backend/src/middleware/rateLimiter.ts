import { Request, Response, NextFunction } from 'express';
import IORedis from 'ioredis';
import config from '../config';
import { logger } from './logger';

const redis = new IORedis(config.redis.url, {
  password: config.redis.password,
  maxRetriesPerRequest: 3,
});

interface RateLimitOptions {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  keyPrefix?: string;    // Redis key prefix
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export class RedisRateLimiter {
  private windowMs: number;
  private maxRequests: number;
  private keyPrefix: string;
  private skipSuccessfulRequests: boolean;
  private skipFailedRequests: boolean;

  constructor(options: RateLimitOptions) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
    this.keyPrefix = options.keyPrefix || 'ratelimit:';
    this.skipSuccessfulRequests = options.skipSuccessfulRequests || false;
    this.skipFailedRequests = options.skipFailedRequests || false;
  }

  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const identifier = this.getIdentifier(req);
      const key = `${this.keyPrefix}${identifier}`;

      try {
        const requests = await this.incrementCounter(key);

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', this.maxRequests);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, this.maxRequests - requests));
        res.setHeader('X-RateLimit-Reset', Date.now() + this.windowMs);

        if (requests > this.maxRequests) {
          logger.warn('Rate limit exceeded', {
            identifier,
            requests,
            limit: this.maxRequests,
            path: req.path,
          });

          return res.status(429).json({
            success: false,
            error: 'Too many requests, please try again later',
            retryAfter: Math.ceil(this.windowMs / 1000),
          });
        }

        // Decrement counter for successful requests if configured
        if (this.skipSuccessfulRequests) {
          res.on('finish', async () => {
            if (res.statusCode < 400) {
              await this.decrementCounter(key);
            }
          });
        }

        // Decrement counter for failed requests if configured
        if (this.skipFailedRequests) {
          res.on('finish', async () => {
            if (res.statusCode >= 400) {
              await this.decrementCounter(key);
            }
          });
        }

        next();
      } catch (error) {
        logger.error('Rate limiter error', { error, identifier });
        // Fail open - allow request if rate limiter fails
        next();
      }
    };
  }

  private getIdentifier(req: Request): string {
    // Try to get user ID if authenticated
    const userId = (req as any).user?.id;
    if (userId) {
      return `user:${userId}`;
    }

    // Fall back to IP address
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return `ip:${ip}`;
  }

  private async incrementCounter(key: string): Promise<number> {
    const multi = redis.multi();

    multi.incr(key);
    multi.pexpire(key, this.windowMs);

    const results = await multi.exec();

    if (!results || !results[0]) {
      throw new Error('Redis transaction failed');
    }

    const count = results[0][1] as number;
    return count;
  }

  private async decrementCounter(key: string): Promise<void> {
    await redis.decr(key);
  }

  async resetLimit(identifier: string): Promise<void> {
    const key = `${this.keyPrefix}${identifier}`;
    await redis.del(key);
  }

  async getCurrentCount(identifier: string): Promise<number> {
    const key = `${this.keyPrefix}${identifier}`;
    const count = await redis.get(key);
    return count ? parseInt(count, 10) : 0;
  }
}

// Pre-configured rate limiters
export const apiRateLimiter = new RedisRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  keyPrefix: 'ratelimit:api:',
});

export const strictRateLimiter = new RedisRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  keyPrefix: 'ratelimit:strict:',
});

export const authRateLimiter = new RedisRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  keyPrefix: 'ratelimit:auth:',
  skipSuccessfulRequests: true, // Only count failed attempts
});

export const paymentRateLimiter = new RedisRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 3,
  keyPrefix: 'ratelimit:payment:',
});
