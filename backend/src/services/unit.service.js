import { UnitModel } from '../models/sql/unit.model.js';
import { ApiError } from '../utils/apiError.js';

export const UnitService = {
  /**
   * Retrieves all measurement units with conversion ratios
   */
  async getUnits(filters = {}) {
    return await UnitModel.findAll(filters);
  },

  /**
   * Retrieves a single unit by ID with base unit details
   */
  async getUnitById(id) {
    const unit = await UnitModel.findById(id);
    if (!unit) {
      throw ApiError.notFound(`Unit of measure with ID ${id} not found`, 'UNIT_NOT_FOUND');
    }
    return unit;
  }
};

export default UnitService;
