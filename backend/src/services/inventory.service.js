import { InventoryModel } from '../models/sql/inventory.model.js';
import { IngredientModel } from '../models/sql/ingredient.model.js';
import { ApiError } from '../utils/apiError.js';

export const InventoryService = {
  /**
   * Retrieves paginated ingredient inventory overview with stock status and valuation
   */
  async getOverview(filters = {}) {
    return await InventoryModel.getOverview(filters);
  },

  /**
   * Retrieves high-level operational inventory KPIs
   */
  async getSummary() {
    return await InventoryModel.getSummary();
  },

  /**
   * Retrieves single ingredient stock, active batches, and supplier matrix
   */
  async getIngredientDetails(ingredientId) {
    const details = await InventoryModel.getIngredientDetails(ingredientId);
    if (!details) {
      throw ApiError.notFound(`Ingredient with ID ${ingredientId} not found`, 'INGREDIENT_NOT_FOUND');
    }
    return details;
  },

  /**
   * Retrieves paginated batches with FEFO sorting and filtering
   */
  async getBatches(filters = {}) {
    if (filters.ingredientId) {
      const ingredient = await IngredientModel.findById(filters.ingredientId);
      if (!ingredient) {
        throw ApiError.notFound(`Ingredient with ID ${filters.ingredientId} not found`, 'INGREDIENT_NOT_FOUND');
      }
    }
    return await InventoryModel.getBatches(filters);
  },

  /**
   * Retrieves a single inventory batch by ID with movement ledger
   */
  async getBatchById(id) {
    const batch = await InventoryModel.getBatchById(id);
    if (!batch) {
      throw ApiError.notFound(`Inventory batch with ID ${id} not found`, 'BATCH_NOT_FOUND');
    }
    return batch;
  },

  /**
   * Retrieves expiring and expired batches report
   */
  async getExpiringBatches(filters = {}) {
    if (filters.ingredientId) {
      const ingredient = await IngredientModel.findById(filters.ingredientId);
      if (!ingredient) {
        throw ApiError.notFound(`Ingredient with ID ${filters.ingredientId} not found`, 'INGREDIENT_NOT_FOUND');
      }
    }
    return await InventoryModel.getExpiringBatches(filters);
  },

  /**
   * Retrieves low-stock and out-of-stock ingredients
   */
  async getLowStockIngredients(filters = {}) {
    return await InventoryModel.getLowStockIngredients(filters);
  },

  /**
   * Retrieves audit ledger of stock movements
   */
  async getStockMovements(filters = {}) {
    if (filters.ingredientId) {
      const ingredient = await IngredientModel.findById(filters.ingredientId);
      if (!ingredient) {
        throw ApiError.notFound(`Ingredient with ID ${filters.ingredientId} not found`, 'INGREDIENT_NOT_FOUND');
      }
    }
    if (filters.batchId) {
      const batch = await InventoryModel.getBatchById(filters.batchId);
      if (!batch) {
        throw ApiError.notFound(`Inventory batch with ID ${filters.batchId} not found`, 'BATCH_NOT_FOUND');
      }
    }
    return await InventoryModel.getStockMovements(filters);
  }
};

export default InventoryService;
