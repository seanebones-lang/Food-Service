import { Request, Response, NextFunction } from 'express';
import { trackHttpRequest } from '../services/metrics.service';

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  // Capture response
  const originalSend = res.send;
  res.send = function (data: any): Response {
    res.send = originalSend;

    // Track metrics after response
    const duration = (Date.now() - start) / 1000; // Convert to seconds
    const route = req.route?.path || req.path;

    trackHttpRequest(req.method, route, res.statusCode, duration);

    return originalSend.call(this, data);
  };

  next();
};
