import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../index';

/**
 * WebSocket Authentication Middleware
 *
 * Secures Socket.IO connections with JWT authentication
 * and role-based authorization.
 */

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    email: string;
    role: string;
    name: string;
  };
}

/**
 * Middleware to authenticate Socket.IO connections
 *
 * Usage:
 * io.use(socketAuthMiddleware);
 */
export const socketAuthMiddleware = async (
  socket: AuthenticatedSocket,
  next: (err?: Error) => void
) => {
  try {
    // Get token from handshake auth or query
    const token =
      socket.handshake.auth.token ||
      socket.handshake.headers.authorization?.replace('Bearer ', '') ||
      socket.handshake.query.token as string;

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    // Verify JWT token
    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;

    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    if (!user) {
      return next(new Error('User not found'));
    }

    // Attach user to socket
    socket.user = user;

    // Log connection
    console.log(`[WebSocket] User ${user.email} (${user.role}) connected: ${socket.id}`);

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new Error('Invalid token'));
    }
    if (error instanceof jwt.TokenExpiredError) {
      return next(new Error('Token expired'));
    }
    return next(new Error('Authentication failed'));
  }
};

/**
 * Middleware to check if user has required role
 *
 * Usage:
 * socket.use(requireRole(['ADMIN', 'MANAGER']));
 */
export const requireRole = (allowedRoles: string[]) => {
  return (socket: AuthenticatedSocket, next: (err?: Error) => void) => {
    if (!socket.user) {
      return next(new Error('Not authenticated'));
    }

    if (!allowedRoles.includes(socket.user.role)) {
      return next(new Error('Insufficient permissions'));
    }

    next();
  };
};

/**
 * Helper to emit to authenticated users with specific roles
 */
export const emitToRoles = (io: any, roles: string[], event: string, data: any) => {
  const sockets = Array.from(io.sockets.sockets.values()) as AuthenticatedSocket[];

  sockets.forEach((socket) => {
    if (socket.user && roles.includes(socket.user.role)) {
      socket.emit(event, data);
    }
  });
};

/**
 * Helper to emit to a specific user
 */
export const emitToUser = (io: any, userId: string, event: string, data: any) => {
  const sockets = Array.from(io.sockets.sockets.values()) as AuthenticatedSocket[];

  sockets.forEach((socket) => {
    if (socket.user && socket.user.id === userId) {
      socket.emit(event, data);
    }
  });
};

/**
 * Event handler wrapper with authentication check
 */
export const authenticatedHandler = (
  handler: (socket: AuthenticatedSocket, ...args: any[]) => void | Promise<void>
) => {
  return async (socket: AuthenticatedSocket, ...args: any[]) => {
    if (!socket.user) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      await handler(socket, ...args);
    } catch (error) {
      console.error('[WebSocket] Handler error:', error);
      socket.emit('error', { message: 'Internal server error' });
    }
  };
};

/**
 * Role-based event handler wrapper
 */
export const roleHandler = (
  allowedRoles: string[],
  handler: (socket: AuthenticatedSocket, ...args: any[]) => void | Promise<void>
) => {
  return async (socket: AuthenticatedSocket, ...args: any[]) => {
    if (!socket.user) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    if (!allowedRoles.includes(socket.user.role)) {
      socket.emit('error', { message: 'Insufficient permissions' });
      return;
    }

    try {
      await handler(socket, ...args);
    } catch (error) {
      console.error('[WebSocket] Handler error:', error);
      socket.emit('error', { message: 'Internal server error' });
    }
  };
};

/**
 * Room-based authorization
 * Ensures users can only join rooms they have access to
 */
export const authorizeRoom = (
  socket: AuthenticatedSocket,
  room: string
): boolean => {
  if (!socket.user) {
    return false;
  }

  const { role } = socket.user;

  // Room naming convention: {type}-{id}
  // Example: restaurant-123, kitchen-456, order-789

  const [roomType, roomId] = room.split('-');

  switch (roomType) {
    case 'kitchen':
      // Only kitchen staff and managers can join kitchen rooms
      return ['KITCHEN', 'MANAGER', 'ADMIN'].includes(role);

    case 'restaurant':
      // All staff can join their restaurant room
      return ['STAFF', 'KITCHEN', 'MANAGER', 'ADMIN'].includes(role);

    case 'order':
      // All staff can join order rooms
      return ['STAFF', 'KITCHEN', 'MANAGER', 'ADMIN'].includes(role);

    case 'admin':
      // Only admins can join admin rooms
      return role === 'ADMIN';

    default:
      return false;
  }
};

/**
 * Secure room join with authorization
 */
export const secureJoinRoom = (
  socket: AuthenticatedSocket,
  room: string
): boolean => {
  if (!authorizeRoom(socket, room)) {
    socket.emit('error', {
      message: 'Not authorized to join this room',
      room,
    });
    return false;
  }

  socket.join(room);
  console.log(`[WebSocket] User ${socket.user?.email} joined room: ${room}`);
  return true;
};

/**
 * Secure room leave
 */
export const secureLeaveRoom = (
  socket: AuthenticatedSocket,
  room: string
): void => {
  socket.leave(room);
  console.log(`[WebSocket] User ${socket.user?.email} left room: ${room}`);
};

/**
 * Get all rooms a user has access to
 */
export const getAuthorizedRooms = (socket: AuthenticatedSocket): string[] => {
  if (!socket.user) {
    return [];
  }

  const { role } = socket.user;
  const baseRooms: string[] = [];

  // Add role-based default rooms
  if (['KITCHEN', 'MANAGER', 'ADMIN'].includes(role)) {
    baseRooms.push('kitchen');
  }

  if (['STAFF', 'KITCHEN', 'MANAGER', 'ADMIN'].includes(role)) {
    baseRooms.push('orders');
  }

  if (role === 'ADMIN') {
    baseRooms.push('admin');
  }

  return baseRooms;
};

/**
 * Rate limiting for WebSocket events
 */
class WebSocketRateLimiter {
  private limits: Map<string, number[]> = new Map();
  private readonly maxEvents: number;
  private readonly windowMs: number;

  constructor(maxEvents: number = 100, windowMs: number = 60000) {
    this.maxEvents = maxEvents;
    this.windowMs = windowMs;
  }

  check(socketId: string): boolean {
    const now = Date.now();
    const userEvents = this.limits.get(socketId) || [];

    // Remove old events outside the window
    const recentEvents = userEvents.filter((time) => now - time < this.windowMs);

    if (recentEvents.length >= this.maxEvents) {
      return false; // Rate limit exceeded
    }

    // Add new event
    recentEvents.push(now);
    this.limits.set(socketId, recentEvents);

    return true;
  }

  reset(socketId: string): void {
    this.limits.delete(socketId);
  }
}

export const wsRateLimiter = new WebSocketRateLimiter(100, 60000);

/**
 * Rate limit middleware for WebSocket events
 */
export const rateLimitHandler = (
  handler: (socket: AuthenticatedSocket, ...args: any[]) => void | Promise<void>
) => {
  return async (socket: AuthenticatedSocket, ...args: any[]) => {
    if (!wsRateLimiter.check(socket.id)) {
      socket.emit('error', {
        message: 'Rate limit exceeded. Please slow down.',
      });
      return;
    }

    await handler(socket, ...args);
  };
};
