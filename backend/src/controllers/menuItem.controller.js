import { MenuItemService } from '../services/menuItem.service.js';
import { ApiResponse } from '../utils/apiResponse.js';

export const MenuItemController = {
  /**
   * @route   GET /api/v1/menu-items
   * @desc    List menu items with pagination, search, category filter, and availability status
   * @access  Private (Authenticated Staff)
   */
  async getMenuItems(req, res, next) {
    try {
      const { page, limit, search, category_id, isAvailable } = req.query;
      const result = await MenuItemService.getMenuItems({
        page,
        limit,
        search,
        categoryId: category_id,
        isAvailable
      });

      return ApiResponse.ok(res, result.menuItems, 'Menu items retrieved successfully', {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
      });
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   GET /api/v1/menu-items/:id
   * @desc    Get menu item details by ID with category and recipe information
   * @access  Private (Authenticated Staff)
   */
  async getMenuItemById(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const menuItem = await MenuItemService.getMenuItemById(id);
      return ApiResponse.ok(res, menuItem, 'Menu item details retrieved successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   POST /api/v1/menu-items
   * @desc    Create a new sellable menu item
   * @access  Private (ADMIN, INVENTORY_MANAGER)
   */
  async createMenuItem(req, res, next) {
    try {
      const menuItemData = req.body;
      const actingUser = req.user;
      const requestId = req.headers['x-request-id'] || null;

      const newMenuItem = await MenuItemService.createMenuItem(menuItemData, actingUser, requestId);
      return ApiResponse.created(res, newMenuItem, 'Menu item created successfully');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * @route   PATCH /api/v1/menu-items/:id
   * @desc    Update menu item details
   * @access  Private (ADMIN, INVENTORY_MANAGER)
   */
  async updateMenuItem(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const updateData = req.body;
      const actingUser = req.user;
      const requestId = req.headers['x-request-id'] || null;

      const updatedMenuItem = await MenuItemService.updateMenuItem(id, updateData, actingUser, requestId);
      return ApiResponse.ok(res, updatedMenuItem, 'Menu item updated successfully');
    } catch (error) {
      return next(error);
    }
  }
};

export default MenuItemController;
