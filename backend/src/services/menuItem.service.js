import { MenuItemModel } from '../models/sql/menuItem.model.js';
import { CategoryModel } from '../models/sql/category.model.js';
import { ApiError } from '../utils/apiError.js';
import { AuditLog } from '../models/mongo/AuditLog.js';

export const MenuItemService = {
  /**
   * Retrieves menu items with filtering, search, pagination, and category/recipe JOINs
   */
  async getMenuItems(filters = {}) {
    return await MenuItemModel.findAll(filters);
  },

  /**
   * Retrieves a single menu item by ID with complete category and recipe details
   */
  async getMenuItemById(id) {
    const menuItem = await MenuItemModel.findById(id);
    if (!menuItem) {
      throw ApiError.notFound(`Menu item with ID ${id} not found`, 'MENU_ITEM_NOT_FOUND');
    }
    return menuItem;
  },

  /**
   * Creates a new sellable menu item
   */
  async createMenuItem(data, actingUser, requestId = null) {
    // 1. Validate category foreign reference
    const category = await CategoryModel.findById(data.category_id);
    if (!category) {
      throw ApiError.badRequest(`Category with ID ${data.category_id} does not exist`, 'INVALID_CATEGORY_ID');
    }

    // 2. Prevent duplicate menu item names
    const isTaken = await MenuItemModel.isNameTaken(data.name);
    if (isTaken) {
      throw ApiError.conflict(`Menu item '${data.name.trim()}' already exists`, 'DUPLICATE_MENU_ITEM_NAME');
    }

    // 3. Validate non-negative selling price
    if (data.selling_price < 0) {
      throw ApiError.badRequest('Selling price must be non-negative', 'INVALID_PRICE');
    }

    // 4. Persist in MySQL
    const newId = await MenuItemModel.create({
      category_id: data.category_id,
      name: data.name,
      description: data.description || null,
      selling_price: data.selling_price,
      preparation_time_mins: data.preparation_time_mins !== undefined ? data.preparation_time_mins : 15,
      is_available: data.is_available !== undefined ? data.is_available : true
    });

    // 5. Record audit trail in MongoDB Atlas
    await AuditLog.record({
      userId: actingUser.id,
      username: actingUser.username,
      action: 'MENU_ITEM_CREATED',
      resourceType: 'MENU_ITEM',
      resourceId: String(newId),
      requestId,
      metadata: {
        menuItemId: newId,
        menuItemName: data.name.trim(),
        categoryId: data.category_id,
        categoryName: category.name,
        sellingPrice: data.selling_price,
        preparationTimeMins: data.preparation_time_mins !== undefined ? data.preparation_time_mins : 15
      }
    });

    return await this.getMenuItemById(newId);
  },

  /**
   * Updates an existing menu item
   */
  async updateMenuItem(id, updateData, actingUser, requestId = null) {
    // 1. Verify existence
    const existing = await this.getMenuItemById(id);

    const fieldsToUpdate = {};

    // 2. Validate category if changed
    if (updateData.category_id !== undefined && updateData.category_id !== existing.category_id) {
      const category = await CategoryModel.findById(updateData.category_id);
      if (!category) {
        throw ApiError.badRequest(`Category with ID ${updateData.category_id} does not exist`, 'INVALID_CATEGORY_ID');
      }
      fieldsToUpdate.category_id = updateData.category_id;
    }

    // 3. Prevent duplicate name if changed
    if (updateData.name && updateData.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const isTaken = await MenuItemModel.isNameTaken(updateData.name, id);
      if (isTaken) {
        throw ApiError.conflict(`Menu item '${updateData.name.trim()}' already exists`, 'DUPLICATE_MENU_ITEM_NAME');
      }
      fieldsToUpdate.name = updateData.name.trim();
    }

    // 4. Validate non-negative selling price if changed
    if (updateData.selling_price !== undefined) {
      if (updateData.selling_price < 0) {
        throw ApiError.badRequest('Selling price must be non-negative', 'INVALID_PRICE');
      }
      fieldsToUpdate.selling_price = updateData.selling_price;
    }

    if (updateData.description !== undefined) {
      fieldsToUpdate.description = updateData.description !== null ? updateData.description.trim() : null;
    }

    if (updateData.preparation_time_mins !== undefined) {
      if (updateData.preparation_time_mins < 0) {
        throw ApiError.badRequest('Preparation time cannot be negative', 'INVALID_PREP_TIME');
      }
      fieldsToUpdate.preparation_time_mins = updateData.preparation_time_mins;
    }

    if (updateData.is_available !== undefined) {
      fieldsToUpdate.is_available = updateData.is_available;
    }

    // 5. Persist update in MySQL
    if (Object.keys(fieldsToUpdate).length > 0) {
      await MenuItemModel.update(id, fieldsToUpdate);
    }

    // 6. Record audit trail in MongoDB Atlas
    await AuditLog.record({
      userId: actingUser.id,
      username: actingUser.username,
      action: 'MENU_ITEM_UPDATED',
      resourceType: 'MENU_ITEM',
      resourceId: String(id),
      requestId,
      metadata: {
        menuItemId: id,
        updatedFields: Object.keys(fieldsToUpdate)
      }
    });

    return await this.getMenuItemById(id);
  }
};

export default MenuItemService;
