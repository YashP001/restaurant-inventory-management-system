import { UnitService } from '../services/unit.service.js';
import { ApiResponse } from '../utils/apiResponse.js';

export const UnitController = {
  /**
   * @route   GET /api/v1/units
   * @desc    List units of measure with conversion ratios
   * @access  Private (Authenticated Staff)
   */
  async getUnits(req, res, next) {
    try {
      const { unitType, search } = req.query;
      const units = await UnitService.getUnits({ unitType, search });
      return ApiResponse.ok(res, units, 'Units of measure retrieved successfully', {
        totalCount: units.length
      });
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   GET /api/v1/units/:id
   * @desc    Get unit of measure details by ID
   * @access  Private (Authenticated Staff)
   */
  async getUnitById(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const unit = await UnitService.getUnitById(id);
      return ApiResponse.ok(res, unit, 'Unit of measure details retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }
};

export default UnitController;
