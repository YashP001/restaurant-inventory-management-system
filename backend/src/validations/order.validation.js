import { z } from 'zod';

const orderItemInputSchema = z.object({
  menu_item_id: z.coerce.number().int().positive('menu_item_id must be a positive integer'),
  quantity: z.coerce.number().int().positive('quantity must be at least 1').default(1),
  special_instructions: z.string().trim().max(255, 'special_instructions cannot exceed 255 characters').optional().nullable()
});

export const createOrderSchema = {
  body: z.object({
    order_type: z.enum(['DINE_IN', 'TAKEAWAY', 'ONLINE'], {
      errorMap: () => ({ message: "order_type must be 'DINE_IN', 'TAKEAWAY', or 'ONLINE'" })
    }),
    table_id: z.coerce.number().int().positive('table_id must be a positive integer').optional().nullable(),
    notes: z.string().trim().max(255, 'notes cannot exceed 255 characters').optional().nullable(),
    items: z.array(orderItemInputSchema).optional()
  }).refine(data => {
    if (data.order_type === 'DINE_IN' && data.table_id === undefined) {
      // Allow optional table_id or ensure if provided it is valid
      return true;
    }
    return true;
  })
};

export const listOrdersQuerySchema = {
  query: z.object({
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(20).optional(),
    status: z.enum(['PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'DELIVERED', 'COMPLETED', 'CANCELLED']).optional(),
    order_type: z.enum(['DINE_IN', 'TAKEAWAY', 'ONLINE']).optional(),
    table_id: z.coerce.number().int().positive().optional(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'start_date must be in YYYY-MM-DD format').optional(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'end_date must be in YYYY-MM-DD format').optional(),
    search: z.string().trim().optional()
  })
};

export const orderIdParamSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Order ID or order_number is required')
  })
};

export const cancelOrderSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Order ID or order_number is required')
  }),
  body: z.object({
    record_waste: z.boolean().optional().default(false),
    waste_reason: z.enum(['CUSTOMER_RETURN', 'PREPARATION_SCRAP', 'OVERCOOKED', 'SPOILED']).optional().default('CUSTOMER_RETURN'),
    notes: z.string().trim().max(255).optional()
  }).optional()
};

export const addOrderItemSchema = {
  body: z.object({
    menu_item_id: z.coerce.number().int().positive('menu_item_id must be a positive integer'),
    quantity: z.coerce.number().int().positive('quantity must be at least 1').default(1),
    special_instructions: z.string().trim().max(255, 'special_instructions cannot exceed 255 characters').optional().nullable()
  })
};

export const updateOrderItemSchema = {
  body: z.object({
    quantity: z.coerce.number().int().positive('quantity must be at least 1').optional(),
    special_instructions: z.string().trim().max(255, 'special_instructions cannot exceed 255 characters').optional().nullable()
  }).refine(data => Object.keys(data).length > 0, {
    message: 'At least one field (quantity or special_instructions) must be provided'
  })
};

export const orderItemParamSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Order ID or order_number is required'),
    itemId: z.coerce.number().int().positive('Item ID must be a positive integer')
  })
};
