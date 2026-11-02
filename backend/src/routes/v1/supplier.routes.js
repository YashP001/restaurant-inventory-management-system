import { Router } from 'express';
import { SupplierController } from '../../controllers/supplier.controller.js';
import { authenticateJWT } from '../../middleware/auth.js';
import { requireRole, ROLES } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  createSupplierSchema,
  updateSupplierSchema,
  listSuppliersQuerySchema,
  supplierIdParamSchema,
  mapSupplierIngredientSchema,
  supplierIngredientParamSchema
} from '../../validations/supplier.validation.js';

const router = Router();

// Global authentication required for all supplier endpoints
router.use(authenticateJWT);

/**
 * @route   GET /api/v1/suppliers
 * @desc    List suppliers with pagination, search, and active filter
 * @access  Private (All authenticated staff)
 */
router.get(
  '/',
  validate(listSuppliersQuerySchema),
  SupplierController.listSuppliers
);

/**
 * @route   POST /api/v1/suppliers
 * @desc    Create a new supplier
 * @access  Private (ADMIN, INVENTORY_MANAGER)
 */
router.post(
  '/',
  requireRole(ROLES.ADMIN, ROLES.INVENTORY_MANAGER),
  validate(createSupplierSchema),
  SupplierController.createSupplier
);

/**
 * @route   GET /api/v1/suppliers/:id
 * @desc    Get detailed supplier information
 * @access  Private (All authenticated staff)
 */
router.get(
  '/:id',
  validate(supplierIdParamSchema),
  SupplierController.getSupplierById
);

/**
 * @route   PATCH /api/v1/suppliers/:id
 * @desc    Update an existing supplier
 * @access  Private (ADMIN, INVENTORY_MANAGER)
 */
router.patch(
  '/:id',
  requireRole(ROLES.ADMIN, ROLES.INVENTORY_MANAGER),
  validate(supplierIdParamSchema),
  validate(updateSupplierSchema),
  SupplierController.updateSupplier
);

/**
 * @route   GET /api/v1/suppliers/:id/ingredients
 * @desc    List ingredients mapped to a supplier
 * @access  Private (All authenticated staff)
 */
router.get(
  '/:id/ingredients',
  validate(supplierIdParamSchema),
  SupplierController.getSupplierIngredients
);

/**
 * @route   POST /api/v1/suppliers/:id/ingredients
 * @desc    Map an ingredient to a supplier
 * @access  Private (ADMIN, INVENTORY_MANAGER)
 */
router.post(
  '/:id/ingredients',
  requireRole(ROLES.ADMIN, ROLES.INVENTORY_MANAGER),
  validate(supplierIdParamSchema),
  validate(mapSupplierIngredientSchema),
  SupplierController.mapSupplierIngredient
);

/**
 * @route   DELETE /api/v1/suppliers/:id/ingredients/:ingredientId
 * @desc    Unmap an ingredient from a supplier
 * @access  Private (ADMIN, INVENTORY_MANAGER)
 */
router.delete(
  '/:id/ingredients/:ingredientId',
  requireRole(ROLES.ADMIN, ROLES.INVENTORY_MANAGER),
  validate(supplierIngredientParamSchema),
  SupplierController.unmapSupplierIngredient
);

export default router;
