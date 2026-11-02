import { Router } from 'express';
import { ProcurementController } from '../../controllers/procurement.controller.js';
import { authenticateJWT } from '../../middleware/auth.js';
import { requireRole, ROLES } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  procurementRecommendationsQuerySchema,
  convertToPOSchema
} from '../../validations/procurement.validation.js';

const router = Router();

// Authentication required for all procurement endpoints
router.use(authenticateJWT);

/**
 * @route   GET /api/v1/procurement/recommendations
 * @desc    Get intelligent procurement recommendations
 * @access  Private (ADMIN, INVENTORY_MANAGER)
 */
router.get(
  '/recommendations',
  requireRole(ROLES.ADMIN, ROLES.INVENTORY_MANAGER),
  validate(procurementRecommendationsQuerySchema),
  ProcurementController.getRecommendations
);

/**
 * @route   POST /api/v1/procurement/recommendations/convert-to-po
 * @desc    Convert selected purchase recommendations into DRAFT purchase orders
 * @access  Private (ADMIN, INVENTORY_MANAGER)
 */
router.post(
  '/recommendations/convert-to-po',
  requireRole(ROLES.ADMIN, ROLES.INVENTORY_MANAGER),
  validate(convertToPOSchema),
  ProcurementController.convertToPO
);

export default router;

