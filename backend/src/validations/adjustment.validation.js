import { z } from 'zod';

export const createAdjustmentSchema = {
  body: z.object({
    ingredient_id: z.coerce.number().int().positive('ingredient_id must be a positive integer'),
    batch_id: z.coerce.number().int().positive('batch_id must be a positive integer'),
    adjustment_type: z.enum(['INCREASE', 'DECREASE'], {
      errorMap: () => ({ message: "adjustment_type must be either 'INCREASE' or 'DECREASE'" })
    }),
    quantity: z.coerce.number().positive('Adjustment quantity must be greater than zero'),
    reason: z
      .string()
      .trim()
      .min(3, 'Adjustment reason must be at least 3 characters long')
      .max(255, 'Adjustment reason cannot exceed 255 characters'),
    notes: z.string().trim().max(255).optional()
  })
};

export const listAdjustmentsQuerySchema = {
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    ingredient_id: z.coerce.number().int().positive().optional(),
    batch_id: z.coerce.number().int().positive().optional(),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be in YYYY-MM-DD format')
      .optional(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be in YYYY-MM-DD format')
      .optional()
  })
};

export const adjustmentIdParamSchema = {
  params: z.object({
    id: z.coerce.number().int().positive('Adjustment ID must be a positive integer')
  })
};
