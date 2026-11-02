import { SupplierModel } from '../models/sql/supplier.model.js';
import { IngredientModel } from '../models/sql/ingredient.model.js';
import { ApiError } from '../utils/apiError.js';
import { AuditLog } from '../models/mongo/AuditLog.js';

export const SupplierService = {
  /**
   * Retrieves paginated suppliers list
   */
  async listSuppliers(filters = {}) {
    return await SupplierModel.listSuppliers(filters);
  },

  /**
   * Retrieves detailed supplier record by ID including mapped ingredients
   */
  async getSupplierById(id) {
    const supplier = await SupplierModel.findById(id);
    if (!supplier) {
      throw ApiError.notFound(`Supplier with ID ${id} not found`, 'SUPPLIER_NOT_FOUND');
    }
    const ingredients = await SupplierModel.getSupplierIngredients(id);
    return {
      ...supplier,
      ingredients
    };
  },

  /**
   * Creates a new supplier with duplicate name and email validations
   */
  async createSupplier(data, actingUser, requestId = null) {
    // 1. Check duplicate supplier name
    const existingName = await SupplierModel.findByName(data.name);
    if (existingName) {
      throw ApiError.conflict(`Supplier with name '${data.name}' already exists`, 'SUPPLIER_NAME_EXISTS');
    }

    // 2. Check duplicate email
    const existingEmail = await SupplierModel.findByEmail(data.email);
    if (existingEmail) {
      throw ApiError.conflict(`Supplier with email '${data.email}' already exists`, 'SUPPLIER_EMAIL_EXISTS');
    }

    // 3. Create supplier
    const supplierId = await SupplierModel.createSupplier(data);
    const createdSupplier = await SupplierModel.findById(supplierId);

    // 4. Audit Log
    await AuditLog.record({
      userId: actingUser.id,
      username: actingUser.username,
      action: 'SUPPLIER_CREATED',
      resourceType: 'SUPPLIER',
      resourceId: String(supplierId),
      requestId,
      metadata: {
        supplierId,
        name: createdSupplier.name,
        email: createdSupplier.email,
        phone: createdSupplier.phone,
        leadTimeDays: createdSupplier.lead_time_days
      }
    });

    return createdSupplier;
  },

  /**
   * Updates an existing supplier record
   */
  async updateSupplier(id, data, actingUser, requestId = null) {
    const supplier = await SupplierModel.findById(id);
    if (!supplier) {
      throw ApiError.notFound(`Supplier with ID ${id} not found`, 'SUPPLIER_NOT_FOUND');
    }

    // Check duplicate name if changing
    if (data.name && data.name !== supplier.name) {
      const existingName = await SupplierModel.findByName(data.name, id);
      if (existingName) {
        throw ApiError.conflict(`Supplier with name '${data.name}' already exists`, 'SUPPLIER_NAME_EXISTS');
      }
    }

    // Check duplicate email if changing
    if (data.email && data.email !== supplier.email) {
      const existingEmail = await SupplierModel.findByEmail(data.email, id);
      if (existingEmail) {
        throw ApiError.conflict(`Supplier with email '${data.email}' already exists`, 'SUPPLIER_EMAIL_EXISTS');
      }
    }

    await SupplierModel.updateSupplier(id, data);
    const updatedSupplier = await SupplierModel.findById(id);

    // Audit Log
    await AuditLog.record({
      userId: actingUser.id,
      username: actingUser.username,
      action: 'SUPPLIER_UPDATED',
      resourceType: 'SUPPLIER',
      resourceId: String(id),
      requestId,
      metadata: {
        supplierId: id,
        changes: data
      }
    });

    return updatedSupplier;
  },

  /**
   * Retrieves all ingredients provided by a supplier
   */
  async getSupplierIngredients(supplierId) {
    const supplier = await SupplierModel.findById(supplierId);
    if (!supplier) {
      throw ApiError.notFound(`Supplier with ID ${supplierId} not found`, 'SUPPLIER_NOT_FOUND');
    }
    return await SupplierModel.getSupplierIngredients(supplierId);
  },

  /**
   * Maps an ingredient to a supplier with contract unit cost and MOQ
   */
  async mapSupplierIngredient(supplierId, data, actingUser, requestId = null) {
    const supplier = await SupplierModel.findById(supplierId);
    if (!supplier) {
      throw ApiError.notFound(`Supplier with ID ${supplierId} not found`, 'SUPPLIER_NOT_FOUND');
    }

    const ingredient = await IngredientModel.findById(data.ingredient_id);
    if (!ingredient) {
      throw ApiError.notFound(`Ingredient with ID ${data.ingredient_id} not found`, 'INGREDIENT_NOT_FOUND');
    }

    // Check duplicate mapping
    const existingMapping = await SupplierModel.findSupplierIngredient(supplierId, data.ingredient_id);
    if (existingMapping) {
      throw ApiError.conflict(
        `Ingredient '${ingredient.name}' is already mapped to supplier '${supplier.name}'`,
        'SUPPLIER_INGREDIENT_ALREADY_MAPPED'
      );
    }

    const mappingId = await SupplierModel.mapSupplierIngredient({
      supplier_id: supplierId,
      ingredient_id: data.ingredient_id,
      contract_unit_cost: data.contract_unit_cost,
      minimum_order_quantity: data.minimum_order_quantity ?? 1.000,
      is_preferred_supplier: data.is_preferred_supplier ?? false
    });

    const mapping = await SupplierModel.findSupplierIngredient(supplierId, data.ingredient_id);

    // Audit Log
    await AuditLog.record({
      userId: actingUser.id,
      username: actingUser.username,
      action: 'SUPPLIER_INGREDIENT_MAPPED',
      resourceType: 'SUPPLIER_INGREDIENT',
      resourceId: String(mappingId),
      requestId,
      metadata: {
        mappingId,
        supplierId,
        supplierName: supplier.name,
        ingredientId: data.ingredient_id,
        ingredientName: ingredient.name,
        contractUnitCost: data.contract_unit_cost,
        minimumOrderQuantity: data.minimum_order_quantity ?? 1.000,
        isPreferredSupplier: data.is_preferred_supplier ?? false
      }
    });

    return mapping;
  },

  /**
   * Removes an ingredient mapping from a supplier
   */
  async unmapSupplierIngredient(supplierId, ingredientId, actingUser, requestId = null) {
    const supplier = await SupplierModel.findById(supplierId);
    if (!supplier) {
      throw ApiError.notFound(`Supplier with ID ${supplierId} not found`, 'SUPPLIER_NOT_FOUND');
    }

    const existingMapping = await SupplierModel.findSupplierIngredient(supplierId, ingredientId);
    if (!existingMapping) {
      throw ApiError.notFound(
        `Mapping between supplier ID ${supplierId} and ingredient ID ${ingredientId} not found`,
        'SUPPLIER_INGREDIENT_MAPPING_NOT_FOUND'
      );
    }

    await SupplierModel.unmapSupplierIngredient(supplierId, ingredientId);

    // Audit Log
    await AuditLog.record({
      userId: actingUser.id,
      username: actingUser.username,
      action: 'SUPPLIER_INGREDIENT_UNMAPPED',
      resourceType: 'SUPPLIER_INGREDIENT',
      resourceId: String(existingMapping.id),
      requestId,
      metadata: {
        mappingId: existingMapping.id,
        supplierId,
        supplierName: supplier.name,
        ingredientId,
        ingredientName: existingMapping.ingredient_name
      }
    });

    return {
      supplier_id: supplierId,
      ingredient_id: ingredientId,
      unmapped: true
    };
  }
};

export default SupplierService;
