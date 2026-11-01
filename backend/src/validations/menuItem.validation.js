import { z } from 'zod';

export const listMenuItemsQuerySchema = {
  query: z.object({
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(20).optional(),
    search: z.string().trim().max(100).optional(),
    category_id: z.coerce.number().int().positive().optional(),
    isAvailable: z
      .enum(['true', 'false', '1', '0', 'all'])
      .transform(val => {
        if (val === 'all') return null;
        return val === 'true' || val === '1';
      })
      .optional()
  })
};

export const menuItemIdParamSchema = {
  params: z.object({
    id: z.coerce.number().int().positive('Menu item ID must be a positive integer')
  })
};

export const createMenuItemSchema = {
  body: z.object({
    name: z
      .string({ required_error: 'Menu item name is required' })
      .trim()
      .min(2, 'Menu item name must be at least 2 characters long')
      .max(150, 'Menu item name cannot exceed 150 characters'),
    category_id: z.coerce
      .number({ required_error: 'category_id is required' })
      .int()
      .positive('category_id must be a positive integer'),
    description: z
      .string()
      .trim()
      .max(1000, 'Description cannot exceed 1000 characters')
      .optional()
      .nullable(),
    selling_price: z.coerce
      .number({ required_error: 'selling_price is required' })
      .min(0, 'Selling price must be non-negative'),
    preparation_time_mins: z.coerce
      .number()
      .int()
      .min(0, 'Preparation time cannot be negative')
      .default(15)
      .optional(),
    is_available: z.boolean().default(true).optional()
  })
};

export const updateMenuItemSchema = {
  params: z.object({
    id: z.coerce.number().int().positive('Menu item ID must be a positive integer')
  }),
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, 'Menu item name must be at least 2 characters long')
      .max(150, 'Menu item name cannot exceed 150 characters')
      .optional(),
    category_id: z.coerce
      .number()
      .int()
      .positive('category_id must be a positive integer')
      .optional(),
    description: z
      .string()
      .trim()
      .max(1000, 'Description cannot exceed 1000 characters')
      .optional()
      .nullable(),
    selling_price: z.coerce
      .number()
      .min(0, 'Selling price must be non-negative')
      .optional(),
    preparation_time_mins: z.coerce
      .number()
      .int()
      .min(0, 'Preparation time cannot be negative')
      .optional(),
    is_available: z.boolean().optional()
  }).refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update'
  })
};
