import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { requestLogger } from './middleware/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import apiRouter from './routes/index.js';

const app = express();

// Security & Cross-Origin Resource Sharing
app.use(cors({
  origin: env.FRONTEND_URL === '*' ? '*' : [env.FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true
}));

// Body Parsing Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logging
app.use(requestLogger);

// Root Welcome Endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Restaurant & Food Inventory Management System API',
    version: '1.0.0',
    docs: '/api/health'
  });
});

// API Routes
app.use('/api', apiRouter);

// 404 Catch-All
app.use(notFoundHandler);

// Centralized Error Handling
app.use(errorHandler);

export default app;
