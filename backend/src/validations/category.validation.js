import { z } from 'zod';

export const listCategoriesQuerySchema = {
  query: z.object({
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(50).optional(),
    search: z.string().trim().max(100).optional(),
    isActive: z
      .enum(['true', 'false', '1', '0', 'all'])
      .transform(val => {
        if (val === 'all') return null;
        return val === 'true' || val === '1';
      })
      .optional()
  })
};

export const categoryIdParamSchema = {
  params: z.object({
    id: z.coerce.number().int().positive('Category ID must be a positive integer')
  })
};

export const createCategorySchema = {
  body: z.object({
    name: z
      .string({ required_error: 'Category name is required' })
      .trim()
      .min(2, 'Category name must be at least 2 characters long')
      .max(100, 'Category name cannot exceed 100 characters'),
    description: z
      .string()
      .trim()
      .max(1000, 'Description cannot exceed 1000 characters')
      .optional()
      .nullable(),
    is_active: z.boolean().default(true).optional()
  })
};

export const updateCategorySchema = {
  params: z.object({
    id: z.coerce.number().int().positive('Category ID must be a positive integer')
  }),
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, 'Category name must be at least 2 characters long')
      .max(100, 'Category name cannot exceed 100 characters')
      .optional(),
    description: z
      .string()
      .trim()
      .max(1000, 'Description cannot exceed 1000 characters')
      .optional()
      .nullable(),
    is_active: z.boolean().optional()
  }).refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update'
  })
};
