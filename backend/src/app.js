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

const app = express();
const config = getConfig();

// Trust proxy
app.set('trust proxy', 1);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Cookie parser
app.use(cookieParser());

const productionOrigins = config.corsOrigins.length
  ? config.corsOrigins
  : ['https://restaurent-saas.vercel.app'];
const vercelPreviewOriginPattern = /^https:\/\/restaurent-saas(?:-[a-z0-9-]+)*\.vercel\.app$/i;

const allowedOrigins = config.nodeEnv === 'production'
  ? productionOrigins
  : [
      ...productionOrigins,
      'http://localhost:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'http://localhost:3000',
    ];

// CORS configuration - Configured for development and production
const corsOptions = {
  origin: function(origin, callback) {
    const isAllowedPreviewOrigin = typeof origin === 'string' && vercelPreviewOriginPattern.test(origin);

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.includes(origin) || isAllowedPreviewOrigin) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked for origin: ${origin}`);
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.get('/health', (req, res) => {
  res.status(200).send('Server running');
});

// Initialize Cloudinary
initCloudinary();

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
