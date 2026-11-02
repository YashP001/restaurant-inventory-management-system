import { z } from 'zod';

export const createPaymentSchema = {
  body: z.object({
    payment_method: z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'UPI', 'ONLINE'], {
      errorMap: () => ({ message: "payment_method must be one of: 'CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'UPI', 'ONLINE'" })
    }),
    amount_paid: z.coerce.number().positive('amount_paid must be strictly greater than 0'),
    transaction_reference: z.string().trim().max(100, 'transaction_reference cannot exceed 100 characters').optional().nullable()
  })
};
