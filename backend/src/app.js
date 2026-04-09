import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import logger from './utils/logger.js';
import { getConfig } from './config/environment.js';
import { initCloudinary } from './config/cloudinary.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { sanitizeInput } from './utils/sanitizer.js';
import routes from './routes/index.js';
import MaintenanceService from './services/maintenanceService.js';

const app = express();
const config = getConfig();

// Trust proxy
app.set('trust proxy', 1);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Cookie parser
app.use(cookieParser());

const localhostOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];

const productionOrigins = config.corsOrigins.length
  ? config.corsOrigins
  : ['https://restaurent-saas.vercel.app'];

const allowedOrigins = config.nodeEnv === 'production'
  ? productionOrigins
  : [...productionOrigins, ...localhostOrigins];

const isAllowedOrigin = (origin) => {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.includes(origin) || localhostOrigins.includes(origin)) {
    return true;
  }

  try {
    const parsedOrigin = new URL(origin);
    const isVercelDeployment = parsedOrigin.protocol === 'https:' && parsedOrigin.hostname.endsWith('.vercel.app');

    return isVercelDeployment;
  } catch {
    return false;
  }
};

// CORS configuration - Configured for development and production
const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked for origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Restaurant-Id'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.get('/health', (req, res) => {
  res.status(200).send('Server running');
});

// Initialize Cloudinary
initCloudinary();

// Initialize maintenance service for scheduled cleanup jobs
MaintenanceService.init();

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const origin = req.headers.origin || 'no-origin';
  const userAgent = req.headers['user-agent'] || 'unknown';
  
  logger.info(`[${timestamp}] ${req.method} ${req.path}`);
  logger.info(`  Origin: ${origin}`);
  logger.info(`  IP: ${req.ip}`);
  
  // Log response when it's finished
  res.on('finish', () => {
    logger.info(`  Response: ${res.statusCode}`);
  });
  
  next();
});

// Global rate limiter (except health check)
app.use((req, res, next) => {
  if (req.path === '/health' || req.path === '/api/health') {
    return next();
  }
  apiLimiter(req, res, next);
});

// Input sanitization middleware
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeInput(req.body);
  }
  next();
});

// Routes
app.use('/api', routes);

// 404 handler
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

logger.info('✅ Express app configured successfully');

export default app;
