import { ApiError } from '../utils/apiError.js';

/**
 * Bill of Materials (BOM) Expansion Service
 * Converts predicted menu-item demand into raw ingredient requirements using
 * recipe yield servings, wastage allowance percentages, and unit of measure conversion ratios.
 */
export const BOMService = {
  /**
   * Computes the conversion ratio from recipe unit to ingredient base unit.
   * Both units must belong to the same dimension (WEIGHT, VOLUME, COUNT).
   */
  calculateUnitConversionRatio({
    recipeUnitType,
    recipeConversionFactor,
    ingredientUnitType,
    ingredientBaseConversionFactor
  }) {
    if (recipeUnitType !== ingredientUnitType) {
      throw ApiError.badRequest(
        `Cannot convert incompatible unit dimensions: recipe uses ${recipeUnitType} but ingredient uses ${ingredientUnitType}`,
        'INCOMPATIBLE_UNIT_TYPES'
      );
    }

    if (!recipeConversionFactor || recipeConversionFactor <= 0) {
      throw ApiError.badRequest('Invalid recipe unit conversion factor', 'INVALID_UNIT_CONVERSION');
    }

    if (!ingredientBaseConversionFactor || ingredientBaseConversionFactor <= 0) {
      throw ApiError.badRequest('Invalid ingredient base unit conversion factor', 'INVALID_UNIT_CONVERSION');
    }

    // Recipe factor / Ingredient base factor
    // e.g., Grams (0.001) to Kilograms (1.000) = 0.001 / 1.000 = 0.001
    // e.g., Milliliters (0.001) to Liters (1.000) = 0.001 / 1.000 = 0.001
    // e.g., Dozen (12.0) to Piece (1.0) = 12.0 / 1.0 = 12.0
    return Number(recipeConversionFactor) / Number(ingredientBaseConversionFactor);
  },

  /**
   * Calculates required ingredient quantity for a single BOM line item.
   *
   * Formula:
   * Required = Predicted Menu Qty * Quantity Required * (1 + Wastage % / 100) / Yield Servings * Conversion Ratio
   */
  calculateIngredientRequirement({
    predictedMenuQuantity,
    quantityRequired,
    wastageAllowancePercent = 0.0,
    yieldServings = 1,
    unitConversionRatio = 1.0
  }) {
    if (predictedMenuQuantity < 0) {
      throw ApiError.badRequest('predictedMenuQuantity cannot be negative', 'INVALID_FORECAST_QUANTITY');
    }
    if (quantityRequired <= 0) {
      throw ApiError.badRequest('quantityRequired must be positive', 'INVALID_BOM_QUANTITY');
    }
    if (yieldServings < 1) {
      throw ApiError.badRequest('yieldServings must be at least 1', 'INVALID_RECIPE_YIELD');
    }
    if (wastageAllowancePercent < 0 || wastageAllowancePercent >= 100) {
      throw ApiError.badRequest('wastageAllowancePercent must be between 0 and 99.99', 'INVALID_WASTAGE_PERCENT');
    }

    const wastageMultiplier = 1.0 + (Number(wastageAllowancePercent) / 100.0);
    const rawQuantity = (
      Number(predictedMenuQuantity) *
      Number(quantityRequired) *
      wastageMultiplier
    ) / Number(yieldServings);

    return rawQuantity * Number(unitConversionRatio);
  },

  /**
   * Expands an array of menu item forecasts into daily and aggregated ingredient demand.
   *
   * @param {Array} menuForecasts - Array of { date, menu_item_id, predicted_quantity }
   * @param {Array} recipesBOM - Array of recipe ingredient lines from ForecastModel.getActiveRecipesWithBOM()
   * @returns {Object} { dailyIngredientDemand, aggregatedIngredientDemand, summary }
   */
  expandMenuForecastsToIngredients(menuForecasts, recipesBOM) {
    if (!menuForecasts || menuForecasts.length === 0) {
      return {
        dailyIngredientDemand: [],
        aggregatedIngredientDemand: [],
        summary: { totalMenuForecastLines: 0, totalExpandedLines: 0 }
      };
    }

    // Group recipe ingredients by menu_item_id
    const recipeMap = new Map();
    for (const line of recipesBOM) {
      if (!recipeMap.has(line.menu_item_id)) {
        recipeMap.set(line.menu_item_id, []);
      }
      recipeMap.get(line.menu_item_id).push(line);
    }

    // Map: date -> ingredient_id -> accumulated data
    const dailyMap = new Map();
    // Map: ingredient_id -> accumulated total data
    const totalMap = new Map();

    for (const fc of menuForecasts) {
      const menuItemId = Number(fc.menu_item_id);
      const forecastDate = fc.date instanceof Date ? fc.date.toISOString().split('T')[0] : String(fc.date);
      const predictedQty = Number(fc.predicted_quantity || 0);

      const bomLines = recipeMap.get(menuItemId);
      if (!bomLines || bomLines.length === 0) {
        // Menu item has no recipe defined yet; skip or log
        continue;
      }

      for (const bom of bomLines) {
        const ratio = this.calculateUnitConversionRatio({
          recipeUnitType: bom.recipe_unit_type,
          recipeConversionFactor: bom.recipe_conversion_factor,
          ingredientUnitType: bom.ingredient_unit_type,
          ingredientBaseConversionFactor: bom.ingredient_base_conversion_factor
        });

        const ingredientQty = this.calculateIngredientRequirement({
          predictedMenuQuantity: predictedQty,
          quantityRequired: bom.quantity_required,
          wastageAllowancePercent: bom.wastage_allowance_percent,
          yieldServings: bom.yield_servings,
          unitConversionRatio: ratio
        });

        // Accumulate in dailyMap
        if (!dailyMap.has(forecastDate)) {
          dailyMap.set(forecastDate, new Map());
        }
        const dateSubMap = dailyMap.get(forecastDate);

        if (!dateSubMap.has(bom.ingredient_id)) {
          dateSubMap.set(bom.ingredient_id, {
            date: forecastDate,
            ingredient_id: bom.ingredient_id,
            ingredient_name: bom.ingredient_name,
            unit_id: bom.ingredient_base_unit_id,
            unit_name: bom.ingredient_base_unit_name,
            unit_abbr: bom.ingredient_base_unit_abbr,
            required_quantity: 0.0,
            menu_items_breakdown: []
          });
        }

        const entry = dateSubMap.get(bom.ingredient_id);
        entry.required_quantity += ingredientQty;
        entry.menu_items_breakdown.push({
          menu_item_id: menuItemId,
          menu_item_name: bom.menu_item_name,
          predicted_quantity: predictedQty,
          portion_used: Number(ingredientQty.toFixed(4))
        });

        // Accumulate in totalMap
        if (!totalMap.has(bom.ingredient_id)) {
          totalMap.set(bom.ingredient_id, {
            ingredient_id: bom.ingredient_id,
            ingredient_name: bom.ingredient_name,
            unit_id: bom.ingredient_base_unit_id,
            unit_name: bom.ingredient_base_unit_name,
            unit_abbr: bom.ingredient_base_unit_abbr,
            total_required_quantity: 0.0,
            daily_breakdown: {}
          });
        }
        const totalEntry = totalMap.get(bom.ingredient_id);
        totalEntry.total_required_quantity += ingredientQty;
        totalEntry.daily_breakdown[forecastDate] = (totalEntry.daily_breakdown[forecastDate] || 0) + ingredientQty;
      }
    }

    // Format daily output sorted by date, ingredient_id
    const dailyIngredientDemand = [];
    const sortedDates = Array.from(dailyMap.keys()).sort();
    for (const d of sortedDates) {
      const ingMap = dailyMap.get(d);
      const sortedIngs = Array.from(ingMap.keys()).sort((a, b) => a - b);
      for (const ingId of sortedIngs) {
        const item = ingMap.get(ingId);
        dailyIngredientDemand.push({
          ...item,
          required_quantity: Number(item.required_quantity.toFixed(4))
        });
      }
    }

    // Format aggregated output sorted by ingredient_id
    const aggregatedIngredientDemand = Array.from(totalMap.values())
      .sort((a, b) => a.ingredient_id - b.ingredient_id)
      .map(item => ({
        ...item,
        total_required_quantity: Number(item.total_required_quantity.toFixed(4)),
        daily_breakdown: Object.fromEntries(
          Object.entries(item.daily_breakdown).map(([dt, q]) => [dt, Number(q.toFixed(4))])
        )
      }));

    return {
      dailyIngredientDemand,
      aggregatedIngredientDemand,
      summary: {
        totalMenuForecastLines: menuForecasts.length,
        totalExpandedLines: dailyIngredientDemand.length,
        uniqueIngredientsCount: aggregatedIngredientDemand.length
      }
    };
  }
};

