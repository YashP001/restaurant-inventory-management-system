import { z } from 'zod';

export const listIngredientsQuerySchema = {
  query: z.object({
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(20).optional(),
    search: z.string().trim().max(100).optional(),
    unit_id: z.coerce.number().int().positive().optional(),
    category_id: z.coerce.number().int().positive().optional(),
    isActive: z
      .enum(['true', 'false', '1', '0', 'all'])
      .transform(val => {
        if (val === 'all') return null;
        return val === 'true' || val === '1';
      })
      .optional()
  })
};

export const ingredientIdParamSchema = {
  params: z.object({
    id: z.coerce.number().int().positive('Ingredient ID must be a positive integer')
  })
};

export const createIngredientSchema = {
  body: z.object({
    name: z
      .string({ required_error: 'Ingredient name is required' })
      .trim()
      .min(2, 'Ingredient name must be at least 2 characters long')
      .max(150, 'Ingredient name cannot exceed 150 characters'),
    unit_id: z.coerce
      .number({ invalid_type_error: 'unit_id must be a number' })
      .int()
      .positive('unit_id must be a positive integer')
      .optional(),
    base_unit_id: z.coerce
      .number()
      .int()
      .positive('base_unit_id must be a positive integer')
      .optional(),
    category_id: z.coerce
      .number()
      .int()
      .positive('category_id must be a positive integer')
      .optional()
      .nullable(),
    minimum_stock_level: z.coerce
      .number()
      .min(0, 'minimum_stock_level cannot be negative')
      .default(0)
      .optional(),
    optimal_par_level: z.coerce
      .number()
      .min(0, 'optimal_par_level cannot be negative')
      .default(0)
      .optional(),
    cost_per_unit: z.coerce
      .number()
      .min(0, 'cost_per_unit cannot be negative')
      .default(0)
      .optional(),
    is_active: z.boolean().default(true).optional()
  }).refine(data => data.unit_id !== undefined || data.base_unit_id !== undefined, {
    message: 'Either unit_id or base_unit_id is required',
    path: ['unit_id']
  }).refine(
    data => {
      const min = data.minimum_stock_level ?? 0;
      const par = data.optimal_par_level ?? 0;
      return par >= min;
    },
    {
      message: 'optimal_par_level must be greater than or equal to minimum_stock_level',
      path: ['optimal_par_level']
    }
  )
};

export const updateIngredientSchema = {
  params: z.object({
    id: z.coerce.number().int().positive('Ingredient ID must be a positive integer')
  }),
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, 'Ingredient name must be at least 2 characters long')
      .max(150, 'Ingredient name cannot exceed 150 characters')
      .optional(),
    unit_id: z.coerce
      .number()
      .int()
      .positive('unit_id must be a positive integer')
      .optional(),
    base_unit_id: z.coerce
      .number()
      .int()
      .positive('base_unit_id must be a positive integer')
      .optional(),
    category_id: z.coerce
      .number()
      .int()
      .positive('category_id must be a positive integer')
      .optional()
      .nullable(),
    minimum_stock_level: z.coerce
      .number()
      .min(0, 'minimum_stock_level cannot be negative')
      .optional(),
    optimal_par_level: z.coerce
      .number()
      .min(0, 'optimal_par_level cannot be negative')
      .optional(),
    cost_per_unit: z.coerce
      .number()
      .min(0, 'cost_per_unit cannot be negative')
      .optional(),
    is_active: z.boolean().optional()
  }).refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update'
  }).refine(
    data => {
      if (data.minimum_stock_level !== undefined && data.optimal_par_level !== undefined) {
        return data.optimal_par_level >= data.minimum_stock_level;
      }
      return true;
    },
    {
      message: 'optimal_par_level must be greater than or equal to minimum_stock_level',
      path: ['optimal_par_level']
    }
  )
};
