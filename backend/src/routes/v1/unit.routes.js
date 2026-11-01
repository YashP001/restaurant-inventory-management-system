import { Router } from 'express';
import { UnitController } from '../../controllers/unit.controller.js';
import { authenticateJWT } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  listUnitsQuerySchema,
  unitIdParamSchema
} from '../../validations/unit.validation.js';

const router = Router();

// All catalog endpoints require authenticated staff
router.use(authenticateJWT);

/**
 * @route   GET /api/v1/units
 * @desc    List measurement units with conversion ratios
 * @access  Private (Authenticated Staff)
 */
router.get('/', validate(listUnitsQuerySchema), UnitController.getUnits);

/**
 * @route   GET /api/v1/units/:id
 * @desc    Get unit of measure details by ID
 * @access  Private (Authenticated Staff)
 */
router.get('/:id', validate(unitIdParamSchema), UnitController.getUnitById);

export default router;
