import { z } from 'zod';

export const listRecipesQuerySchema = {
  query: z.object({
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(20).optional(),
    search: z.string().trim().max(100).optional(),
    menu_item_id: z.coerce.number().int().positive().optional()
  })
};

export const recipeIdParamSchema = {
  params: z.object({
    id: z.coerce.number().int().positive('Recipe ID must be a positive integer')
  })
};

export const menuItemIdParamSchema = {
  params: z.object({
    id: z.coerce.number().int().positive('Menu item ID must be a positive integer')
  })
};

export const recipeAndIngredientIdParamSchema = {
  params: z.object({
    id: z.coerce.number().int().positive('Recipe ID must be a positive integer'),
    ingredientId: z.coerce.number().int().positive('Ingredient ID must be a positive integer')
  })
};

const bomLineItemSchema = z.object({
  ingredient_id: z.coerce
    .number({ required_error: 'ingredient_id is required' })
    .int()
    .positive('ingredient_id must be a positive integer'),
  quantity_required: z.coerce
    .number({ required_error: 'quantity_required is required' })
    .positive('quantity_required must be strictly greater than 0'),
  unit_id: z.coerce
    .number({ required_error: 'unit_id is required' })
    .int()
    .positive('unit_id must be a positive integer'),
  wastage_allowance_percent: z.coerce
    .number()
    .min(0, 'wastage_allowance_percent cannot be negative')
    .max(99.99, 'wastage_allowance_percent must be strictly less than 100%')
    .default(0)
    .optional()
});

export const createRecipeSchema = {
  params: z.object({
    id: z.coerce.number().int().positive('Menu item ID must be a positive integer')
  }),
  body: z.object({
    yield_servings: z.coerce
      .number()
      .int('yield_servings must be an integer')
      .min(1, 'yield_servings must be at least 1')
      .default(1)
      .optional(),
    instructions: z
      .string()
      .trim()
      .max(4000, 'instructions cannot exceed 4000 characters')
      .optional()
      .nullable(),
    ingredients: z.array(bomLineItemSchema).optional()
  })
};

export const updateRecipeSchema = {
  params: z.object({
    id: z.coerce.number().int().positive('Recipe ID must be a positive integer')
  }),
  body: z.object({
    yield_servings: z.coerce
      .number()
      .int('yield_servings must be an integer')
      .min(1, 'yield_servings must be at least 1')
      .optional(),
    instructions: z
      .string()
      .trim()
      .max(4000, 'instructions cannot exceed 4000 characters')
      .optional()
      .nullable()
  }).refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update'
  })
};

export const addRecipeIngredientSchema = {
  params: z.object({
    id: z.coerce.number().int().positive('Recipe ID must be a positive integer')
  }),
  body: bomLineItemSchema
};

export const updateRecipeIngredientSchema = {
  params: z.object({
    id: z.coerce.number().int().positive('Recipe ID must be a positive integer'),
    ingredientId: z.coerce.number().int().positive('Ingredient ID must be a positive integer')
  }),
  body: z.object({
    quantity_required: z.coerce
      .number()
      .positive('quantity_required must be strictly greater than 0')
      .optional(),
    unit_id: z.coerce
      .number()
      .int()
      .positive('unit_id must be a positive integer')
      .optional(),
    wastage_allowance_percent: z.coerce
      .number()
      .min(0, 'wastage_allowance_percent cannot be negative')
      .max(99.99, 'wastage_allowance_percent must be strictly less than 100%')
      .optional()
  }).refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update'
  })
};
