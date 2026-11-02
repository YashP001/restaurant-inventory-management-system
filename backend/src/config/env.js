import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend directory first, fallback to root if needed
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Schema for environment variable validation
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  FRONTEND_URL: z.string().default('http://localhost:5173'),

  // MySQL 8 Configuration
  MYSQL_HOST: z.string().min(1, 'MYSQL_HOST is required'),
  MYSQL_PORT: z.coerce.number().default(3306),
  MYSQL_USER: z.string().min(1, 'MYSQL_USER is required'),
  MYSQL_PASSWORD: z.string().default(''),
  MYSQL_DATABASE: z.string().min(1, 'MYSQL_DATABASE is required'),

  // MongoDB Atlas Configuration
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  // JWT Authentication
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters long'),
  JWT_EXPIRES_IN: z.string().default('24h'),

  // Demand Forecasting Service URL
  FORECASTING_SERVICE_URL: z.string().default('http://localhost:8000')
});

// Parse and validate environment variables
const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  const issues = parseResult.error.format();
  console.error('\n❌ FATAL: Invalid environment variable configuration:');
  Object.entries(issues).forEach(([field, details]) => {
    if (field !== '_errors' && details._errors) {
      console.error(`   - ${field}: ${details._errors.join(', ')}`);
    }
  });
  console.error('\nPlease check your backend/.env configuration file.\n');
  process.exit(1);
}

const validated = parseResult.data;

export const env = {
  NODE_ENV: validated.NODE_ENV,
  PORT: validated.PORT,
  FRONTEND_URL: validated.FRONTEND_URL,

  MYSQL: {
    host: validated.MYSQL_HOST,
    port: validated.MYSQL_PORT,
    user: validated.MYSQL_USER,
    password: validated.MYSQL_PASSWORD,
    database: validated.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  },

  MONGODB_URI: validated.MONGODB_URI,

  JWT: {
    secret: validated.JWT_SECRET,
    expiresIn: validated.JWT_EXPIRES_IN
  },

  FORECASTING_SERVICE_URL: validated.FORECASTING_SERVICE_URL
};
