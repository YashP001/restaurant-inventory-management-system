import { z } from 'zod';

export const procurementRecommendationsQuerySchema = {
  query: z.object({
    horizon_days: z.coerce.number().int().min(1).max(30).default(7).optional()
  })
};

const convertItemSchema = z.object({
  ingredient_id: z.coerce.number().int().positive('ingredient_id must be a positive integer'),
  supplier_id: z.coerce.number().int().positive('supplier_id must be a positive integer'),
  quantity: z.coerce.number().positive('quantity must be strictly greater than 0'),
  unit_cost: z.coerce.number().min(0, 'unit_cost cannot be negative').optional()
});

export const convertToPOSchema = {
  body: z.object({
    items: z.array(convertItemSchema).min(1, 'At least one item must be provided for PO conversion'),
    notes: z.string().trim().max(255).optional().nullable()
  })
};

