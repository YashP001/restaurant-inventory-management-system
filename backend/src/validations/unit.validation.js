import { z } from 'zod';

export const listUnitsQuerySchema = {
  query: z.object({
    unitType: z.enum(['WEIGHT', 'VOLUME', 'COUNT']).optional(),
    search: z.string().trim().max(50).optional()
  })
};

export const unitIdParamSchema = {
  params: z.object({
    id: z.coerce.number().int().positive('Unit ID must be a positive integer')
  })
};
