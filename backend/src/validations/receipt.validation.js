import { z } from 'zod';

const receiptItemSchema = z.object({
  purchase_order_item_id: z.coerce.number().int().positive('purchase_order_item_id must be a positive integer').optional(),
  ingredient_id: z.coerce.number().int().positive('ingredient_id must be a positive integer'),
  batch_number: z.string().trim().min(1, 'batch_number is required').max(50, 'batch_number cannot exceed 50 characters'),
  quantity_received: z.coerce.number().positive('quantity_received must be strictly greater than 0'),
  unit_cost: z.coerce.number().min(0, 'unit_cost cannot be negative').optional(),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expiry_date must be in YYYY-MM-DD format')
});

export const createReceiptSchema = {
  body: z.object({
    purchase_order_id: z.coerce.number().int().positive('purchase_order_id must be a positive integer'),
    supplier_id: z.coerce.number().int().positive('supplier_id must be a positive integer'),
    received_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'received_date must be in YYYY-MM-DD format').optional(),
    notes: z.string().trim().max(255, 'notes cannot exceed 255 characters').optional().nullable(),
    items: z.array(receiptItemSchema).min(1, 'At least one item must be included in the receipt')
  })
};

export const listReceiptsQuerySchema = {
  query: z.object({
    supplier_id: z.coerce.number().int().positive().optional(),
    purchase_order_id: z.coerce.number().int().positive().optional(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'start_date must be in YYYY-MM-DD format').optional(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'end_date must be in YYYY-MM-DD format').optional(),
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(20).optional()
  })
};

export const receiptIdParamSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Receipt / PO ID is required')
  })
};
