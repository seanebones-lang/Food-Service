import { z } from 'zod';

export const createOrderSchema = z.object({
  body: z.object({
    orderItems: z.array(
      z.object({
        menuItemId: z.string().min(1, 'Menu item ID is required'),
        quantity: z.number().int().positive('Quantity must be positive'),
        modifiers: z
          .array(
            z.object({
              id: z.string(),
              name: z.string(),
              price: z.number(),
            })
          )
          .optional(),
        notes: z.string().max(500).optional(),
      })
    ).min(1, 'At least one order item is required'),
    customerName: z.string().min(1, 'Customer name is required').max(200),
    customerPhone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
    customerEmail: z.string().email().optional(),
    channel: z.enum(['IN_PERSON', 'ONLINE', 'PHONE', 'QR_CODE']),
    notes: z.string().max(1000).optional(),
    syncToSquare: z.boolean().optional().default(true),
  }),
});

export const updateOrderStatusSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    status: z.enum(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED']),
    notes: z.string().max(500).optional(),
  }),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>['body'];
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
