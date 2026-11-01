import { z } from 'zod';

export const loginSchema = {
  body: z.object({
    identifier: z
      .string({ required_error: 'Username or email is required' })
      .trim()
      .min(1, 'Username or email cannot be empty'),
    password: z
      .string({ required_error: 'Password is required' })
      .min(1, 'Password cannot be empty')
  })
};
