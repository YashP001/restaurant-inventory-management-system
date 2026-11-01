/**
 * Request Validation Middleware using Zod
 * Validates request body, query parameters, and URL path parameters
 * 
 * Usage:
 *   const createOrderSchema = {
 *     body: z.object({
 *       order_type: z.enum(['DINE_IN', 'TAKEAWAY', 'ONLINE']),
 *       items: z.array(z.object({ menu_item_id: z.number(), quantity: z.number().min(1) }))
 *     }),
 *     params: z.object({ id: z.coerce.number().optional() })
 *   };
 *   router.post('/orders', validate(createOrderSchema), orderController.create);
 */
export function validate(schemas) {
  return async (req, res, next) => {
    try {
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params);
      }
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query);
      }
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      return next();
    } catch (error) {
      // Passes ZodError directly to centralized errorHandler
      return next(error);
    }
  };
}

/**
 * Convenient shorthand helper to validate solely request body
 * @param {import('zod').ZodSchema} schema 
 */
export function validateBody(schema) {
  return validate({ body: schema });
}

/**
 * Convenient shorthand helper to validate URL query strings
 * @param {import('zod').ZodSchema} schema 
 */
export function validateQuery(schema) {
  return validate({ query: schema });
}

/**
 * Convenient shorthand helper to validate URL path parameters
 * @param {import('zod').ZodSchema} schema 
 */
export function validateParams(schema) {
  return validate({ params: schema });
}

export default validate;
