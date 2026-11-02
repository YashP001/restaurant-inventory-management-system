import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './v1/auth.routes.js';
import userRoutes from './v1/user.routes.js';
import categoryRoutes from './v1/category.routes.js';
import unitRoutes from './v1/unit.routes.js';
import ingredientRoutes from './v1/ingredient.routes.js';
import menuItemRoutes from './v1/menuItem.routes.js';
import recipeRoutes from './v1/recipe.routes.js';
import inventoryRoutes from './v1/inventory.routes.js';
import supplierRoutes from './v1/supplier.routes.js';
import purchaseOrderRoutes from './v1/purchaseOrder.routes.js';
import orderRoutes from './v1/order.routes.js';

const apiRouter = Router();

// Infrastructure Health Checks (Unversioned)
apiRouter.use('/health', healthRoutes);

// Version 1 Modular API Routes
apiRouter.use('/v1/auth', authRoutes);
apiRouter.use('/v1/users', userRoutes);
apiRouter.use('/v1/categories', categoryRoutes);
apiRouter.use('/v1/units', unitRoutes);
apiRouter.use('/v1/ingredients', ingredientRoutes);
apiRouter.use('/v1/menu-items', menuItemRoutes);
apiRouter.use('/v1/recipes', recipeRoutes);
apiRouter.use('/v1/inventory', inventoryRoutes);
apiRouter.use('/v1/suppliers', supplierRoutes);
apiRouter.use('/v1/purchase-orders', purchaseOrderRoutes);
apiRouter.use('/v1/orders', orderRoutes);

export default apiRouter;
