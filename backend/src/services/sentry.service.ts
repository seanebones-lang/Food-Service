import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';
import config from '../config';
import { logger } from '../middleware/logger';

export const initializeSentry = () => {
  if (!config.sentry.dsn) {
    logger.warn('Sentry DSN not configured, error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: config.sentry.dsn,
    environment: config.env,
    integrations: [
      // Enable HTTP calls tracing
      new Sentry.Integrations.Http({ tracing: true }),
      // Enable Express.js middleware tracing
      new Sentry.Integrations.Express({ app: undefined }),
      // Enable Profiling
      new ProfilingIntegration(),
    ],
    // Performance Monitoring
    tracesSampleRate: config.env === 'production' ? 0.1 : 1.0,
    // Profiling
    profilesSampleRate: config.env === 'production' ? 0.1 : 1.0,
    // Error filtering
    beforeSend(event, hint) {
      // Filter out non-critical errors in production
      if (config.env === 'production') {
        const error = hint.originalException;

        // Don't send validation errors
        if (error && typeof error === 'object' && 'name' in error) {
          if (error.name === 'ValidationError') {
            return null;
          }
        }
      }

      return event;
    },
    // Add custom tags
    initialScope: {
      tags: {
        service: 'restaurant-pos-backend',
        version: process.env.npm_package_version || '2.0.0',
      },
    },
  });

  logger.info('Sentry error tracking initialized', {
    environment: config.env,
    dsn: config.sentry.dsn.substring(0, 20) + '...',
  });
};

export const captureException = (error: Error, context?: Record<string, any>) => {
  Sentry.captureException(error, {
    extra: context,
  });

  logger.error('Exception captured and sent to Sentry', {
    error: error.message,
    stack: error.stack,
    context,
  });
};

export const captureMessage = (message: string, level: Sentry.SeverityLevel = 'info') => {
  Sentry.captureMessage(message, level);
};

export const setUser = (user: { id: string; email: string; role: string }) => {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    role: user.role,
  });
};

export const addBreadcrumb = (breadcrumb: Sentry.Breadcrumb) => {
  Sentry.addBreadcrumb(breadcrumb);
};

export { Sentry };
