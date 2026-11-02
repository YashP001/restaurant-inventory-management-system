import { z } from 'zod';

const poItemInputSchema = z.object({
  ingredient_id: z.coerce.number().int().positive('ingredient_id must be a positive integer'),
  quantity_ordered: z.coerce.number().positive('quantity_ordered must be strictly greater than 0'),
  unit_cost: z.coerce.number().min(0, 'unit_cost cannot be negative').optional()
});

export const createPurchaseOrderSchema = {
  body: z.object({
    supplier_id: z.coerce.number().int().positive('supplier_id must be a positive integer'),
    order_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'order_date must be in YYYY-MM-DD format').optional(),
    expected_delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected_delivery_date must be in YYYY-MM-DD format'),
    notes: z.string().trim().max(255, 'notes cannot exceed 255 characters').optional().nullable(),
    items: z.array(poItemInputSchema).optional()
  }).refine(data => {
    if (!data.order_date || !data.expected_delivery_date) return true;
    return data.expected_delivery_date >= data.order_date;
  }, {
    message: 'expected_delivery_date cannot be earlier than order_date',
    path: ['expected_delivery_date']
  })
};

export const listPurchaseOrdersQuerySchema = {
  query: z.object({
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(20).optional(),
    status: z.enum(['DRAFT', 'SUBMITTED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED']).optional(),
    supplier_id: z.coerce.number().int().positive().optional(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'start_date must be in YYYY-MM-DD format').optional(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'end_date must be in YYYY-MM-DD format').optional(),
    search: z.string().trim().optional()
  })
};

export const purchaseOrderIdParamSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Purchase order ID or number is required')
  })
};

export const addPurchaseOrderItemSchema = {
  body: z.object({
    ingredient_id: z.coerce.number().int().positive('ingredient_id must be a positive integer'),
    quantity_ordered: z.coerce.number().positive('quantity_ordered must be strictly greater than 0'),
    unit_cost: z.coerce.number().min(0, 'unit_cost cannot be negative').optional()
  })
};

export const updatePurchaseOrderItemSchema = {
  body: z.object({
    quantity_ordered: z.coerce.number().positive('quantity_ordered must be strictly greater than 0').optional(),
    unit_cost: z.coerce.number().min(0, 'unit_cost cannot be negative').optional()
  }).refine(data => Object.keys(data).length > 0, {
    message: 'At least one field (quantity_ordered or unit_cost) must be provided'
  })
};

export const purchaseOrderItemParamSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Purchase order ID or number is required'),
    itemId: z.coerce.number().int().positive('PO item ID must be a positive integer')
  })
};
