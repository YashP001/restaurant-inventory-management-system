import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './v1/auth.routes.js';
import userRoutes from './v1/user.routes.js';

const apiRouter = Router();

// Infrastructure Health Checks (Unversioned)
apiRouter.use('/health', healthRoutes);

// Version 1 Modular API Routes
apiRouter.use('/v1/auth', authRoutes);
apiRouter.use('/v1/users', userRoutes);

export default apiRouter;
