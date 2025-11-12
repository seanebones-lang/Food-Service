import { Request, Response, NextFunction } from 'express';
import { auditService } from '../services/audit.service';
import { AuditAction } from '../types/audit';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const auditMiddleware = (action: AuditAction, resource: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const originalSend = res.send;

    // Capture response
    res.send = function (data: any): Response {
      res.send = originalSend;

      // Log audit after response
      setImmediate(async () => {
        try {
          const resourceId = req.params.id || undefined;
          const changes = action === AuditAction.UPDATE ? req.body : undefined;

          await auditService.log({
            userId: req.user?.id || 'anonymous',
            action,
            resource,
            resourceId,
            changes,
            ipAddress: req.ip || req.socket.remoteAddress,
            userAgent: req.get('user-agent'),
            metadata: {
              method: req.method,
              path: req.path,
              statusCode: res.statusCode,
            },
          });
        } catch (error) {
          console.error('Audit logging failed:', error);
        }
      });

      return originalSend.call(this, data);
    };

    next();
  };
};
