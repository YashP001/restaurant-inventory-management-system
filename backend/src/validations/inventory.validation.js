import { z } from 'zod';

export const inventoryOverviewQuerySchema = {
  query: z.object({
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(20).optional(),
    search: z.string().trim().max(100).optional(),
    stock_status: z.enum(['OUT_OF_STOCK', 'LOW_STOCK', 'NORMAL', 'ALL']).optional(),
    category_id: z.coerce.number().int().positive().optional()
  })
};

export const ingredientIdParamSchema = {
  params: z.object({
    ingredientId: z.coerce.number().int().positive('Ingredient ID must be a positive integer')
  })
};

export const batchIdParamSchema = {
  params: z.object({
    id: z.coerce.number().int().positive('Batch ID must be a positive integer')
  })
};

export const listBatchesQuerySchema = {
  query: z.object({
    ingredient_id: z.coerce.number().int().positive().optional(),
    status: z.enum(['ACTIVE', 'EXPIRED', 'DEPLETED', 'DISCARDED', 'ALL']).optional(),
    expiring_before: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
    expiring_after: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
    sort_by: z.enum(['expiry_date', 'received_date', 'quantity_remaining', 'unit_cost', 'batch_number']).default('expiry_date').optional(),
    sort_order: z.enum(['ASC', 'DESC', 'asc', 'desc']).default('ASC').optional(),
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(20).optional()
  })
};

export const expiringBatchesQuerySchema = {
  query: z.object({
    days: z.coerce.number().int().min(1).max(365).default(7).optional(),
    status: z.enum(['EXPIRED', 'EXPIRING_SOON', 'ALL']).default('ALL').optional(),
    ingredient_id: z.coerce.number().int().positive().optional(),
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(20).optional()
  })
};

export const lowStockQuerySchema = {
  query: z.object({
    status: z.enum(['OUT_OF_STOCK', 'LOW_STOCK', 'ALL']).default('ALL').optional(),
    search: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(20).optional()
  })
};

export const stockMovementsQuerySchema = {
  query: z.object({
    ingredient_id: z.coerce.number().int().positive().optional(),
    batch_id: z.coerce.number().int().positive().optional(),
    movement_type: z.enum([
      'PURCHASE_RECEIPT',
      'ORDER_CONSUMPTION',
      'WASTE_DISPOSAL',
      'AUDIT_ADJUSTMENT',
      'RETURN_TO_SUPPLIER',
      'ALL'
    ]).optional(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'start_date must be in YYYY-MM-DD format').optional(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'end_date must be in YYYY-MM-DD format').optional(),
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(20).optional()
  })
};
