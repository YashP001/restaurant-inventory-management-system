import { z } from 'zod';

export const createUserSchema = {
  body: z.object({
    role_id: z.coerce
      .number({ required_error: 'role_id is required' })
      .int()
      .positive('role_id must be a positive integer'),
    username: z
      .string({ required_error: 'username is required' })
      .trim()
      .min(3, 'Username must be at least 3 characters long')
      .max(50, 'Username cannot exceed 50 characters')
      .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores'),
    email: z
      .string({ required_error: 'email is required' })
      .trim()
      .email('Invalid email address format')
      .max(100, 'Email cannot exceed 100 characters'),
    password: z
      .string({ required_error: 'password is required' })
      .min(8, 'Password must be at least 8 characters long'),
    full_name: z
      .string({ required_error: 'full_name is required' })
      .trim()
      .min(2, 'Full name must be at least 2 characters long')
      .max(100, 'Full name cannot exceed 100 characters'),
    phone: z
      .string()
      .trim()
      .max(20, 'Phone cannot exceed 20 characters')
      .optional()
      .nullable(),
    is_active: z.boolean().default(true).optional()
  })
};

export const updateUserSchema = {
  params: z.object({
    id: z.coerce.number().int().positive('User ID must be a positive integer')
  }),
  body: z.object({
    role_id: z.coerce.number().int().positive().optional(),
    username: z
      .string()
      .trim()
      .min(3, 'Username must be at least 3 characters long')
      .max(50)
      .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores')
      .optional(),
    email: z.string().trim().email('Invalid email address format').max(100).optional(),
    password: z.string().min(8, 'Password must be at least 8 characters long').optional(),
    full_name: z.string().trim().min(2).max(100).optional(),
    phone: z.string().trim().max(20).optional().nullable(),
    is_active: z.boolean().optional()
  }).refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update'
  })
};

export const updateStatusSchema = {
  params: z.object({
    id: z.coerce.number().int().positive('User ID must be a positive integer')
  }),
  body: z.object({
    is_active: z.boolean({ required_error: 'is_active boolean is required' })
  })
};

export const userIdParamSchema = {
  params: z.object({
    id: z.coerce.number().int().positive('User ID must be a positive integer')
  })
};

export const listUsersQuerySchema = {
  query: z.object({
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(20).optional(),
    role: z.string().trim().optional(),
    isActive: z.enum(['true', 'false', '1', '0']).optional(),
    search: z.string().trim().optional()
  })
};
