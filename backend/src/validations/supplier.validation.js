import { z } from 'zod';

export const createSupplierSchema = {
  body: z.object({
    name: z.string().trim().min(2, 'Supplier name must be at least 2 characters').max(150, 'Supplier name cannot exceed 150 characters'),
    contact_person: z.string().trim().max(100, 'Contact person cannot exceed 100 characters').optional().nullable(),
    email: z.string().trim().email('Invalid email address format').max(100, 'Email cannot exceed 100 characters'),
    phone: z.string().trim().min(7, 'Phone number must be at least 7 characters').max(20, 'Phone number cannot exceed 20 characters'),
    address: z.string().trim().optional().nullable(),
    lead_time_days: z.coerce.number().int().min(0, 'lead_time_days cannot be negative').default(1).optional(),
    payment_terms: z.string().trim().max(100, 'payment_terms cannot exceed 100 characters').default('Net 30').optional(),
    is_active: z.boolean().default(true).optional()
  })
};

export const updateSupplierSchema = {
  body: z.object({
    name: z.string().trim().min(2, 'Supplier name must be at least 2 characters').max(150, 'Supplier name cannot exceed 150 characters').optional(),
    contact_person: z.string().trim().max(100, 'Contact person cannot exceed 100 characters').optional().nullable(),
    email: z.string().trim().email('Invalid email address format').max(100, 'Email cannot exceed 100 characters').optional(),
    phone: z.string().trim().min(7, 'Phone number must be at least 7 characters').max(20, 'Phone number cannot exceed 20 characters').optional(),
    address: z.string().trim().optional().nullable(),
    lead_time_days: z.coerce.number().int().min(0, 'lead_time_days cannot be negative').optional(),
    payment_terms: z.string().trim().max(100, 'payment_terms cannot exceed 100 characters').optional(),
    is_active: z.boolean().optional()
  }).refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update'
  })
};

export const listSuppliersQuerySchema = {
  query: z.object({
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(20).optional(),
    search: z.string().trim().optional(),
    is_active: z.enum(['true', 'false', '1', '0']).optional()
  })
};

export const supplierIdParamSchema = {
  params: z.object({
    id: z.coerce.number().int().positive('Supplier ID must be a positive integer')
  })
};

export const mapSupplierIngredientSchema = {
  body: z.object({
    ingredient_id: z.coerce.number().int().positive('ingredient_id must be a positive integer'),
    contract_unit_cost: z.coerce.number().min(0, 'contract_unit_cost cannot be negative'),
    minimum_order_quantity: z.coerce.number().positive('minimum_order_quantity must be greater than 0').default(1.000).optional(),
    is_preferred_supplier: z.boolean().default(false).optional()
  })
};

export const supplierIngredientParamSchema = {
  params: z.object({
    id: z.coerce.number().int().positive('Supplier ID must be a positive integer'),
    ingredientId: z.coerce.number().int().positive('Ingredient ID must be a positive integer')
  })
};
