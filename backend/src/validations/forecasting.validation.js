import { z } from 'zod';

export const generateForecastSchema = {
  body: z.object({
    horizon_days: z.coerce.number().int().min(1).max(30).default(7).optional()
  }).optional()
};

export const listForecastsQuerySchema = {
  query: z.object({
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(500).default(50).optional(),
    target_type: z.enum(['MENU_ITEM', 'INGREDIENT']).default('MENU_ITEM').optional(),
    target_id: z.coerce.number().int().positive().optional(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'start_date must be in YYYY-MM-DD format').optional(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'end_date must be in YYYY-MM-DD format').optional()
  })
};

export const ingredientDemandQuerySchema = {
  query: z.object({
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'start_date must be in YYYY-MM-DD format').optional(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'end_date must be in YYYY-MM-DD format').optional()
  })
};

