import { Counter, Histogram, Registry, Gauge } from 'prom-client';
import { Request, Response } from 'express';

// Create a Registry to register metrics
export const register = new Registry();

// ==================== HTTP METRICS ====================

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestErrors = new Counter({
  name: 'http_request_errors_total',
  help: 'Total number of HTTP request errors',
  labelNames: ['method', 'route', 'error_type'],
  registers: [register],
});

// ==================== BUSINESS METRICS ====================

export const ordersCreated = new Counter({
  name: 'orders_created_total',
  help: 'Total number of orders created',
  labelNames: ['channel', 'status'],
  registers: [register],
});

export const ordersValue = new Counter({
  name: 'orders_value_total',
  help: 'Total value of orders in dollars',
  labelNames: ['channel'],
  registers: [register],
});

export const paymentsProcessed = new Counter({
  name: 'payments_processed_total',
  help: 'Total number of payments processed',
  labelNames: ['method', 'status'],
  registers: [register],
});

export const paymentsValue = new Counter({
  name: 'payments_value_total',
  help: 'Total value of payments in dollars',
  labelNames: ['method'],
  registers: [register],
});

export const inventoryLowStock = new Gauge({
  name: 'inventory_low_stock_items',
  help: 'Number of inventory items with low stock',
  registers: [register],
});

export const squareApiCalls = new Counter({
  name: 'square_api_calls_total',
  help: 'Total number of Square API calls',
  labelNames: ['endpoint', 'status'],
  registers: [register],
});

export const squareApiDuration = new Histogram({
  name: 'square_api_duration_seconds',
  help: 'Duration of Square API calls in seconds',
  labelNames: ['endpoint'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

// ==================== CACHE METRICS ====================

export const cacheHits = new Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['key_pattern'],
  registers: [register],
});

export const cacheMisses = new Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['key_pattern'],
  registers: [register],
});

// ==================== DATABASE METRICS ====================

export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'model'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

export const dbErrors = new Counter({
  name: 'db_errors_total',
  help: 'Total number of database errors',
  labelNames: ['operation', 'model', 'error_type'],
  registers: [register],
});

// ==================== QUEUE METRICS ====================

export const queueJobsProcessed = new Counter({
  name: 'queue_jobs_processed_total',
  help: 'Total number of queue jobs processed',
  labelNames: ['queue', 'status'],
  registers: [register],
});

export const queueJobDuration = new Histogram({
  name: 'queue_job_duration_seconds',
  help: 'Duration of queue job processing in seconds',
  labelNames: ['queue'],
  buckets: [0.1, 1, 5, 10, 30, 60, 120],
  registers: [register],
});

// ==================== SYSTEM METRICS ====================

// Collect default metrics (CPU, memory, etc.)
import { collectDefaultMetrics } from 'prom-client';
collectDefaultMetrics({ register });

// ==================== METRICS ENDPOINT ====================

export const metricsHandler = async (req: Request, res: Response) => {
  res.set('Content-Type', register.contentType);
  const metrics = await register.metrics();
  res.end(metrics);
};

// ==================== HELPER FUNCTIONS ====================

export const trackHttpRequest = (
  method: string,
  route: string,
  statusCode: number,
  duration: number
) => {
  httpRequestTotal.inc({ method, route, status_code: statusCode });
  httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);

  if (statusCode >= 400) {
    httpRequestErrors.inc({
      method,
      route,
      error_type: statusCode >= 500 ? 'server_error' : 'client_error',
    });
  }
};

export const trackOrder = (channel: string, status: string, value: number) => {
  ordersCreated.inc({ channel, status });
  ordersValue.inc({ channel }, value);
};

export const trackPayment = (method: string, status: string, value: number) => {
  paymentsProcessed.inc({ method, status });
  if (status === 'COMPLETED') {
    paymentsValue.inc({ method }, value);
  }
};

export const trackSquareApiCall = (
  endpoint: string,
  status: string,
  duration: number
) => {
  squareApiCalls.inc({ endpoint, status });
  squareApiDuration.observe({ endpoint }, duration);
};

export const trackCacheAccess = (keyPattern: string, hit: boolean) => {
  if (hit) {
    cacheHits.inc({ key_pattern: keyPattern });
  } else {
    cacheMisses.inc({ key_pattern: keyPattern });
  }
};
