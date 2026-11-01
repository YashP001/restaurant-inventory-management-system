import { CategoryModel } from '../models/sql/category.model.js';
import { ApiError } from '../utils/apiError.js';
import { AuditLog } from '../models/mongo/AuditLog.js';

export const CategoryService = {
  /**
   * Retrieves categories with optional filtering and pagination
   */
  async getCategories(filters = {}) {
    return await CategoryModel.findAll(filters);
  },

  /**
   * Retrieves category by ID
   */
  async getCategoryById(id) {
    const category = await CategoryModel.findById(id);
    if (!category) {
      throw ApiError.notFound(`Category with ID ${id} not found`, 'CATEGORY_NOT_FOUND');
    }
    return category;
  },

  /**
   * Creates a new menu category
   */
  async createCategory(categoryData, actingUser, requestId = null) {
    // 1. Prevent duplicate category names
    const exists = await CategoryModel.isNameTaken(categoryData.name);
    if (exists) {
      throw ApiError.conflict(`Category '${categoryData.name.trim()}' already exists`, 'DUPLICATE_CATEGORY_NAME');
    }

    // 2. Persist to MySQL
    const newId = await CategoryModel.create(categoryData);

    // 3. Record audit trail in MongoDB Atlas
    await AuditLog.record({
      userId: actingUser.id,
      username: actingUser.username,
      action: 'CATEGORY_CREATED',
      resourceType: 'CATEGORY',
      resourceId: String(newId),
      requestId,
      metadata: {
        categoryId: newId,
        categoryName: categoryData.name.trim(),
        description: categoryData.description || null
      }
    });

    return await this.getCategoryById(newId);
  },

  /**
   * Updates an existing menu category
   */
  async updateCategory(id, updateData, actingUser, requestId = null) {
    // 1. Verify existence
    const existing = await this.getCategoryById(id);

    // 2. Prevent duplicate name if changed
    if (updateData.name && updateData.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const isTaken = await CategoryModel.isNameTaken(updateData.name, id);
      if (isTaken) {
        throw ApiError.conflict(`Category '${updateData.name.trim()}' already exists`, 'DUPLICATE_CATEGORY_NAME');
      }
    }

    // 3. Persist update
    await CategoryModel.update(id, updateData);

    // 4. Record audit trail
    await AuditLog.record({
      userId: actingUser.id,
      username: actingUser.username,
      action: 'CATEGORY_UPDATED',
      resourceType: 'CATEGORY',
      resourceId: String(id),
      requestId,
      metadata: {
        categoryId: id,
        updatedFields: Object.keys(updateData)
      }
    });

    return await this.getCategoryById(id);
  }
};

export default CategoryService;
