import { ApiError } from '../utils/apiError.js';

/**
 * Valid System Roles matching the `roles` table in MySQL:
 * - ADMIN: System configuration, staff management, full access
 * - INVENTORY_MANAGER: Supplier orders, inventory batches, par level adjustments
 * - CHEF: Recipes, menu creation, production, food waste logging
 * - CASHIER: Orders, dining tables, payment processing
 */
export const ROLES = {
  ADMIN: 'ADMIN',
  INVENTORY_MANAGER: 'INVENTORY_MANAGER',
  CHEF: 'CHEF',
  CASHIER: 'CASHIER'
};

/**
 * Role-Based Access Control (RBAC) Authorization Middleware
 * Verifies that the authenticated user's role is in the allowed list
 * 
 * Usage:
 *   router.post('/menu', authenticateJWT, requireRole('ADMIN', 'CHEF'), createMenuItem);
 * 
 * @param  {...string} allowedRoles - List of authorized role strings
 */
export function requireRole(...allowedRoles) {
  // Normalize allowed roles
  const normalizedRoles = allowedRoles.flat().map(r => r.toUpperCase());

  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return next(ApiError.unauthorized('User identity not authenticated', 'UNAUTHENTICATED'));
    }

    if (req.user.is_active === false) {
      return next(ApiError.unauthorized('Authentication failed: Account has been deactivated. Access revoked.', 'ACCOUNT_DEACTIVATED'));
    }

    const userRole = req.user.role.toUpperCase();

    if (!normalizedRoles.includes(userRole)) {
      return next(
        ApiError.forbidden(
          `Access forbidden: Role '${req.user.role}' does not possess required privileges [${normalizedRoles.join(', ')}]`,
          'FORBIDDEN_ROLE',
          {
            userRole: req.user.role,
            requiredRoles: normalizedRoles
          }
        )
      );
    }

    return next();
  };
}

export default requireRole;
