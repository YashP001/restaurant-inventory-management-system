import { z } from 'zod';

export const WASTE_REASONS = [
  'EXPIRED',
  'SPOILED',
  'PREPARATION_SCRAP',
  'OVERCOOKED',
  'CUSTOMER_RETURN',
  'STORAGE_CONTAMINATION'
];

export const createWasteSchema = {
  body: z.object({
    ingredient_id: z.coerce.number().int().positive('ingredient_id must be a positive integer'),
    batch_id: z.coerce.number().int().positive('batch_id must be a positive integer'),
    quantity_wasted: z.coerce.number().positive('quantity_wasted must be greater than zero'),
    waste_reason: z.enum(WASTE_REASONS, {
      errorMap: () => ({ message: `waste_reason must be one of: ${WASTE_REASONS.join(', ')}` })
    }),
    unit_id: z.coerce.number().int().positive('unit_id must be a positive integer').optional(),
    notes: z.string().trim().max(500).optional(),
    waste_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'waste_date must be in YYYY-MM-DD format')
      .optional()
  })
};

export const listWasteQuerySchema = {
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    ingredient_id: z.coerce.number().int().positive().optional(),
    batch_id: z.coerce.number().int().positive().optional(),
    waste_reason: z.enum(WASTE_REASONS).optional(),
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

export const wasteIdParamSchema = {
  params: z.object({
    id: z.coerce.number().int().positive('Waste record ID must be a positive integer')
  })
};
