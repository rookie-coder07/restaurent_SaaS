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

// CORS configuration - Configured for development and production
const corsOptions = {
  origin: function(origin, callback) {
    const allowedOrigins = [
      // Development
      'http://localhost:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'http://localhost:3000',
      // Production
      'https://restromaxsaas.vercel.app',  // Frontend on Vercel
      'https://resturant-saas.onrender.com',  // Backend on Render
      // Environment variable (for flexibility)
      config.corsOrigin
    ];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

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
  if (req.path === '/health') {
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
