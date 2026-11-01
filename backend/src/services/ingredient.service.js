import { IngredientModel } from '../models/sql/ingredient.model.js';
import { UnitModel } from '../models/sql/unit.model.js';
import { CategoryModel } from '../models/sql/category.model.js';
import { ApiError } from '../utils/apiError.js';
import { AuditLog } from '../models/mongo/AuditLog.js';

export const IngredientService = {
  /**
   * Retrieves raw ingredients with pagination, unit resolution, and category filters
   */
  async getIngredients(filters = {}) {
    return await IngredientModel.findAll(filters);
  },

  /**
   * Retrieves a single ingredient by ID with unit and category details
   */
  async getIngredientById(id) {
    const ingredient = await IngredientModel.findById(id);
    if (!ingredient) {
      throw ApiError.notFound(`Ingredient with ID ${id} not found`, 'INGREDIENT_NOT_FOUND');
    }
    return ingredient;
  },

  /**
   * Creates a new raw ingredient with reference integrity validation
   */
  async createIngredient(data, actingUser, requestId = null) {
    // 1. Resolve and validate unit of measure reference
    const targetUnitId = data.unit_id ?? data.base_unit_id;
    if (!targetUnitId) {
      throw ApiError.badRequest('Either unit_id or base_unit_id is required', 'MISSING_UNIT_ID');
    }

    const unit = await UnitModel.findById(targetUnitId);
    if (!unit) {
      throw ApiError.badRequest(`Unit of measure with ID ${targetUnitId} does not exist`, 'INVALID_UNIT_ID');
    }

    // 2. Validate category reference if provided
    let category = null;
    if (data.category_id !== undefined && data.category_id !== null) {
      category = await CategoryModel.findById(data.category_id);
      if (!category) {
        throw ApiError.badRequest(`Category with ID ${data.category_id} does not exist`, 'INVALID_CATEGORY_ID');
      }
    }

    // 3. Prevent duplicate ingredient names
    const isTaken = await IngredientModel.isNameTaken(data.name);
    if (isTaken) {
      throw ApiError.conflict(`Ingredient '${data.name.trim()}' already exists`, 'DUPLICATE_INGREDIENT_NAME');
    }

    // 4. Validate par level threshold
    const minStock = data.minimum_stock_level ?? 0;
    const parLevel = data.optimal_par_level ?? 0;
    if (parLevel < minStock) {
      throw ApiError.badRequest('optimal_par_level must be greater than or equal to minimum_stock_level', 'INVALID_PAR_LEVEL');
    }

    // 5. Persist ingredient in MySQL
    const newId = await IngredientModel.create({
      name: data.name,
      unit_id: targetUnitId,
      minimum_stock_level: minStock,
      optimal_par_level: parLevel,
      cost_per_unit: data.cost_per_unit ?? 0,
      is_active: data.is_active !== undefined ? data.is_active : true
    });

    // 6. Record audit log in MongoDB Atlas
    await AuditLog.record({
      userId: actingUser.id,
      username: actingUser.username,
      action: 'INGREDIENT_CREATED',
      resourceType: 'INGREDIENT',
      resourceId: String(newId),
      requestId,
      metadata: {
        ingredientId: newId,
        ingredientName: data.name.trim(),
        unitId: targetUnitId,
        unitName: unit.name,
        categoryId: category ? category.id : null,
        categoryName: category ? category.name : null,
        minimumStockLevel: minStock,
        optimalParLevel: parLevel,
        costPerUnit: data.cost_per_unit ?? 0
      }
    });

    // 7. Return populated record
    const created = await this.getIngredientById(newId);
    if (category && (!created.categories || created.categories.length === 0)) {
      created.category = { id: category.id, name: category.name };
    }
    return created;
  },

  /**
   * Updates an existing raw ingredient
   */
  async updateIngredient(id, updateData, actingUser, requestId = null) {
    // 1. Verify existence
    const existing = await this.getIngredientById(id);

    const fieldsToUpdate = {};

    // 2. Resolve and validate unit if provided
    const targetUnitId = updateData.unit_id ?? updateData.base_unit_id;
    if (targetUnitId !== undefined) {
      const unit = await UnitModel.findById(targetUnitId);
      if (!unit) {
        throw ApiError.badRequest(`Unit of measure with ID ${targetUnitId} does not exist`, 'INVALID_UNIT_ID');
      }
      fieldsToUpdate.unit_id = targetUnitId;
    }

    // 3. Validate category if provided
    let category = null;
    if (updateData.category_id !== undefined && updateData.category_id !== null) {
      category = await CategoryModel.findById(updateData.category_id);
      if (!category) {
        throw ApiError.badRequest(`Category with ID ${updateData.category_id} does not exist`, 'INVALID_CATEGORY_ID');
      }
    }

    // 4. Prevent duplicate name if changed
    if (updateData.name && updateData.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const isTaken = await IngredientModel.isNameTaken(updateData.name, id);
      if (isTaken) {
        throw ApiError.conflict(`Ingredient '${updateData.name.trim()}' already exists`, 'DUPLICATE_INGREDIENT_NAME');
      }
      fieldsToUpdate.name = updateData.name.trim();
    }

    // 5. Validate thresholds
    const minStock = updateData.minimum_stock_level !== undefined ? updateData.minimum_stock_level : existing.minimum_stock_level;
    const parLevel = updateData.optimal_par_level !== undefined ? updateData.optimal_par_level : existing.optimal_par_level;
    if (parLevel < minStock) {
      throw ApiError.badRequest('optimal_par_level must be greater than or equal to minimum_stock_level', 'INVALID_PAR_LEVEL');
    }

    if (updateData.minimum_stock_level !== undefined) {
      fieldsToUpdate.minimum_stock_level = updateData.minimum_stock_level;
    }
    if (updateData.optimal_par_level !== undefined) {
      fieldsToUpdate.optimal_par_level = updateData.optimal_par_level;
    }
    if (updateData.cost_per_unit !== undefined) {
      fieldsToUpdate.cost_per_unit = updateData.cost_per_unit;
    }
    if (updateData.is_active !== undefined) {
      fieldsToUpdate.is_active = updateData.is_active;
    }

    // 6. Apply updates to MySQL
    if (Object.keys(fieldsToUpdate).length > 0) {
      await IngredientModel.update(id, fieldsToUpdate);
    }

    // 7. Record audit log
    await AuditLog.record({
      userId: actingUser.id,
      username: actingUser.username,
      action: 'INGREDIENT_UPDATED',
      resourceType: 'INGREDIENT',
      resourceId: String(id),
      requestId,
      metadata: {
        ingredientId: id,
        updatedFields: Object.keys(fieldsToUpdate),
        categoryId: category ? category.id : null
      }
    });

    const updated = await this.getIngredientById(id);
    if (category && (!updated.categories || updated.categories.length === 0)) {
      updated.category = { id: category.id, name: category.name };
    }
    return updated;
  }
};

export default IngredientService;
