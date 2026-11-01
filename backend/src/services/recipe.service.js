import { RecipeModel } from '../models/sql/recipe.model.js';
import { MenuItemModel } from '../models/sql/menuItem.model.js';
import { IngredientModel } from '../models/sql/ingredient.model.js';
import { UnitModel } from '../models/sql/unit.model.js';
import { ApiError } from '../utils/apiError.js';
import { AuditLog } from '../models/mongo/AuditLog.js';
import { getMySQLPool } from '../config/mysql.js';

export const RecipeService = {
  /**
   * Retrieves all recipes with pagination, search, and summary costing
   */
  async getRecipes(filters = {}) {
    return await RecipeModel.findAll(filters);
  },

  /**
   * Retrieves a single recipe by ID with full BOM and theoretical costing breakdown
   */
  async getRecipeById(id) {
    const recipe = await RecipeModel.findById(id);
    if (!recipe) {
      throw ApiError.notFound(`Recipe with ID ${id} not found`, 'RECIPE_NOT_FOUND');
    }

    const ingredients = await RecipeModel.getRecipeIngredients(id);

    // Calculate theoretical costing
    const totalCost = Number(
      ingredients.reduce((sum, item) => sum + (item.line_cost || 0), 0).toFixed(2)
    );
    const costPerServing = Number((totalCost / recipe.yield_servings).toFixed(2));
    const sellingPrice = recipe.menu_item.selling_price || 0;
    const grossProfitPerServing = Number((sellingPrice - costPerServing).toFixed(2));
    const foodCostPercentage = sellingPrice > 0
      ? Number(((costPerServing / sellingPrice) * 100).toFixed(2))
      : 0.00;

    return {
      ...recipe,
      ingredients,
      costing: {
        total_recipe_cost: totalCost,
        cost_per_serving: costPerServing,
        selling_price: sellingPrice,
        gross_profit_per_serving: grossProfitPerServing,
        food_cost_percentage: foodCostPercentage
      }
    };
  },

  /**
   * Retrieves a recipe by menu_item_id
   */
  async getRecipeByMenuItemId(menuItemId) {
    const menuItem = await MenuItemModel.findById(menuItemId);
    if (!menuItem) {
      throw ApiError.notFound(`Menu item with ID ${menuItemId} not found`, 'MENU_ITEM_NOT_FOUND');
    }

    const recipe = await RecipeModel.findByMenuItemId(menuItemId);
    if (!recipe) {
      throw ApiError.notFound(`No recipe found for menu item '${menuItem.name}' (ID: ${menuItemId})`, 'RECIPE_NOT_FOUND');
    }

    return await this.getRecipeById(recipe.id);
  },

  /**
   * Creates a new recipe for a menu item with optional initial Bill of Materials (BOM)
   * Executes within an ACID transaction
   */
  async createRecipe(menuItemId, recipeData, actingUser, requestId = null) {
    // 1. Validate menu item exists
    const menuItem = await MenuItemModel.findById(menuItemId);
    if (!menuItem) {
      throw ApiError.notFound(`Menu item with ID ${menuItemId} not found`, 'MENU_ITEM_NOT_FOUND');
    }

    // 2. Prevent duplicate recipes (1:1 constraint)
    const existingRecipe = await RecipeModel.findByMenuItemId(menuItemId);
    if (existingRecipe) {
      throw ApiError.conflict(`A recipe already exists for menu item '${menuItem.name}' (Recipe ID: ${existingRecipe.id})`, 'DUPLICATE_RECIPE');
    }

    // 3. Validate initial BOM items if supplied
    const initialBOM = recipeData.ingredients || [];
    const seenIngredientIds = new Set();

    for (const item of initialBOM) {
      if (seenIngredientIds.has(item.ingredient_id)) {
        throw ApiError.badRequest(`Duplicate ingredient ID ${item.ingredient_id} in recipe creation payload`, 'DUPLICATE_RECIPE_INGREDIENT');
      }
      seenIngredientIds.add(item.ingredient_id);

      const ingredient = await IngredientModel.findById(item.ingredient_id);
      if (!ingredient) {
        throw ApiError.badRequest(`Ingredient with ID ${item.ingredient_id} does not exist`, 'INVALID_INGREDIENT_ID');
      }

      const unit = await UnitModel.findById(item.unit_id);
      if (!unit) {
        throw ApiError.badRequest(`Unit with ID ${item.unit_id} does not exist`, 'INVALID_UNIT_ID');
      }

      if (unit.unit_type !== ingredient.unit.unit_type) {
        throw ApiError.badRequest(
          `Unit dimension mismatch: '${unit.name}' (${unit.unit_type}) cannot measure ingredient '${ingredient.name}' (${ingredient.unit.unit_type})`,
          'UNIT_DIMENSION_MISMATCH'
        );
      }
    }

    // 4. Execute atomic transaction
    const pool = getMySQLPool();
    const conn = await pool.getConnection();
    let newRecipeId = null;

    try {
      await conn.beginTransaction();

      newRecipeId = await RecipeModel.create({
        menu_item_id: menuItemId,
        yield_servings: recipeData.yield_servings || 1,
        instructions: recipeData.instructions || null
      }, conn);

      for (const item of initialBOM) {
        await RecipeModel.addIngredient({
          recipe_id: newRecipeId,
          ingredient_id: item.ingredient_id,
          quantity_required: item.quantity_required,
          unit_id: item.unit_id,
          wastage_allowance_percent: item.wastage_allowance_percent || 0
        }, conn);
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    // 5. Record audit trail in MongoDB Atlas
    await AuditLog.record({
      userId: actingUser.id,
      username: actingUser.username,
      action: 'RECIPE_CREATED',
      resourceType: 'RECIPE',
      resourceId: String(newRecipeId),
      requestId,
      metadata: {
        recipeId: newRecipeId,
        menuItemId,
        menuItemName: menuItem.name,
        yieldServings: recipeData.yield_servings || 1,
        initialBOMCount: initialBOM.length
      }
    });

    return await this.getRecipeById(newRecipeId);
  },

  /**
   * Updates recipe header information (yield_servings, instructions)
   */
  async updateRecipe(id, updateData, actingUser, requestId = null) {
    const existing = await RecipeModel.findById(id);
    if (!existing) {
      throw ApiError.notFound(`Recipe with ID ${id} not found`, 'RECIPE_NOT_FOUND');
    }

    await RecipeModel.update(id, updateData);

    await AuditLog.record({
      userId: actingUser.id,
      username: actingUser.username,
      action: 'RECIPE_UPDATED',
      resourceType: 'RECIPE',
      resourceId: String(id),
      requestId,
      metadata: {
        recipeId: id,
        updatedFields: Object.keys(updateData)
      }
    });

    return await this.getRecipeById(id);
  },

  /**
   * Adds an ingredient line to a recipe's Bill of Materials
   */
  async addRecipeIngredient(recipeId, data, actingUser, requestId = null) {
    // 1. Validate recipe exists
    const recipe = await RecipeModel.findById(recipeId);
    if (!recipe) {
      throw ApiError.notFound(`Recipe with ID ${recipeId} not found`, 'RECIPE_NOT_FOUND');
    }

    // 2. Validate ingredient exists
    const ingredient = await IngredientModel.findById(data.ingredient_id);
    if (!ingredient) {
      throw ApiError.badRequest(`Ingredient with ID ${data.ingredient_id} does not exist`, 'INVALID_INGREDIENT_ID');
    }

    // 3. Validate unit of measure exists
    const unit = await UnitModel.findById(data.unit_id);
    if (!unit) {
      throw ApiError.badRequest(`Unit with ID ${data.unit_id} does not exist`, 'INVALID_UNIT_ID');
    }

    // 4. Confirm dimensional compatibility
    if (unit.unit_type !== ingredient.unit.unit_type) {
      throw ApiError.badRequest(
        `Measurement dimension mismatch: Unit '${unit.name}' (${unit.unit_type}) is incompatible with ingredient '${ingredient.name}' (${ingredient.unit.unit_type})`,
        'UNIT_DIMENSION_MISMATCH'
      );
    }

    // 5. Check duplicate ingredient mapping
    const existingMapping = await RecipeModel.findRecipeIngredient(recipeId, data.ingredient_id);
    if (existingMapping) {
      throw ApiError.conflict(
        `Ingredient '${ingredient.name}' is already part of this recipe's Bill of Materials. Use PATCH to adjust quantity.`,
        'DUPLICATE_RECIPE_INGREDIENT'
      );
    }

    // 6. Insert BOM record
    await RecipeModel.addIngredient({
      recipe_id: recipeId,
      ingredient_id: data.ingredient_id,
      quantity_required: data.quantity_required,
      unit_id: data.unit_id,
      wastage_allowance_percent: data.wastage_allowance_percent || 0
    });

    // 7. Record audit log
    await AuditLog.record({
      userId: actingUser.id,
      username: actingUser.username,
      action: 'RECIPE_INGREDIENT_ADDED',
      resourceType: 'RECIPE',
      resourceId: String(recipeId),
      requestId,
      metadata: {
        recipeId,
        ingredientId: data.ingredient_id,
        ingredientName: ingredient.name,
        quantityRequired: data.quantity_required,
        unitName: unit.name,
        wastageAllowancePercent: data.wastage_allowance_percent || 0
      }
    });

    const updatedRecipe = await this.getRecipeById(recipeId);
    const addedItem = updatedRecipe.ingredients.find(i => i.ingredient_id === data.ingredient_id);

    return {
      ...addedItem,
      recipe: updatedRecipe
    };
  },

  /**
   * Updates an existing ingredient mapping in a recipe BOM
   */
  async updateRecipeIngredient(recipeId, ingredientId, updateData, actingUser, requestId = null) {
    const recipe = await RecipeModel.findById(recipeId);
    if (!recipe) {
      throw ApiError.notFound(`Recipe with ID ${recipeId} not found`, 'RECIPE_NOT_FOUND');
    }

    const existingMapping = await RecipeModel.findRecipeIngredient(recipeId, ingredientId);
    if (!existingMapping) {
      throw ApiError.notFound(`Ingredient ID ${ingredientId} is not mapped to Recipe ID ${recipeId}`, 'RECIPE_INGREDIENT_NOT_FOUND');
    }

    const fieldsToUpdate = {};

    if (updateData.quantity_required !== undefined) {
      fieldsToUpdate.quantity_required = updateData.quantity_required;
    }

    if (updateData.wastage_allowance_percent !== undefined) {
      fieldsToUpdate.wastage_allowance_percent = updateData.wastage_allowance_percent;
    }

    if (updateData.unit_id !== undefined) {
      const unit = await UnitModel.findById(updateData.unit_id);
      if (!unit) {
        throw ApiError.badRequest(`Unit with ID ${updateData.unit_id} does not exist`, 'INVALID_UNIT_ID');
      }

      const ingredient = await IngredientModel.findById(ingredientId);
      if (unit.unit_type !== ingredient.unit.unit_type) {
        throw ApiError.badRequest(
          `Measurement dimension mismatch: Unit '${unit.name}' (${unit.unit_type}) is incompatible with ingredient '${ingredient.name}' (${ingredient.unit.unit_type})`,
          'UNIT_DIMENSION_MISMATCH'
        );
      }
      fieldsToUpdate.unit_id = updateData.unit_id;
    }

    await RecipeModel.updateIngredient(recipeId, ingredientId, fieldsToUpdate);

    await AuditLog.record({
      userId: actingUser.id,
      username: actingUser.username,
      action: 'RECIPE_INGREDIENT_UPDATED',
      resourceType: 'RECIPE',
      resourceId: String(recipeId),
      requestId,
      metadata: {
        recipeId,
        ingredientId,
        updatedFields: Object.keys(fieldsToUpdate)
      }
    });

    const updatedRecipe = await this.getRecipeById(recipeId);
    const updatedItem = updatedRecipe.ingredients.find(i => i.ingredient_id === ingredientId);

    return {
      ...updatedItem,
      recipe: updatedRecipe
    };
  },

  /**
   * Removes an ingredient from a recipe's Bill of Materials
   * Protects historical order consumption integrity
   */
  async removeRecipeIngredient(recipeId, ingredientId, actingUser, requestId = null) {
    const recipe = await RecipeModel.findById(recipeId);
    if (!recipe) {
      throw ApiError.notFound(`Recipe with ID ${recipeId} not found`, 'RECIPE_NOT_FOUND');
    }

    const existingMapping = await RecipeModel.findRecipeIngredient(recipeId, ingredientId);
    if (!existingMapping) {
      throw ApiError.notFound(`Ingredient ID ${ingredientId} is not mapped to Recipe ID ${recipeId}`, 'RECIPE_INGREDIENT_NOT_FOUND');
    }

    // Check historical consumption dependencies
    const historicalCount = await RecipeModel.countHistoricalConsumptions(recipeId, ingredientId);
    if (historicalCount > 0) {
      throw ApiError.badRequest(
        `Cannot remove ingredient '${existingMapping.ingredient_name}': ${historicalCount} historical order consumption records depend on this recipe Bill of Materials mapping.`,
        'HISTORICAL_CONSUMPTION_EXISTS'
      );
    }

    await RecipeModel.removeIngredient(recipeId, ingredientId);

    await AuditLog.record({
      userId: actingUser.id,
      username: actingUser.username,
      action: 'RECIPE_INGREDIENT_REMOVED',
      resourceType: 'RECIPE',
      resourceId: String(recipeId),
      requestId,
      metadata: {
        recipeId,
        ingredientId,
        ingredientName: existingMapping.ingredient_name
      }
    });

    return {
      recipe_id: recipeId,
      removed_ingredient_id: ingredientId,
      ingredient_name: existingMapping.ingredient_name,
      message: `Ingredient '${existingMapping.ingredient_name}' successfully removed from recipe Bill of Materials`
    };
  },

  /**
   * Detailed theoretical recipe costing report
   */
  async getRecipeCosting(id) {
    const recipe = await this.getRecipeById(id);

    const breakdown = recipe.ingredients.map(i => ({
      ingredient_id: i.ingredient_id,
      ingredient_name: i.ingredient_name,
      quantity_required: i.quantity_required,
      unit: i.unit.abbreviation,
      ingredient_base_unit: i.ingredient_base_unit.abbreviation,
      wastage_allowance_percent: i.wastage_allowance_percent,
      cost_per_unit: i.cost_per_unit,
      effective_quantity_base: i.effective_quantity_base,
      line_cost: i.line_cost
    }));

    return {
      recipe_id: recipe.id,
      menu_item_id: recipe.menu_item_id,
      menu_item_name: recipe.menu_item.name,
      selling_price: recipe.menu_item.selling_price,
      yield_servings: recipe.yield_servings,
      costing_method: 'THEORETICAL_REFERENCE_COST',
      cost_type: 'THEORETICAL_REFERENCE_COST',
      cost_basis: 'Calculated using standard ingredient reference costs, unit conversion factors, and preparation wastage allowances, divided by yield servings. Actual batch-level COGS may vary based on FEFO procurement lots.',
      bom_items_count: recipe.ingredients.length,
      costing: recipe.costing,
      summary: recipe.costing,
      breakdown,
      lines: breakdown
    };
  }
};

export default RecipeService;
