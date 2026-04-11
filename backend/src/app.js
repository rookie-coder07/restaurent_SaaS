import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import logger from './utils/logger.js';
import { getConfig } from './config/environment.js';
import { initCloudinary } from './config/cloudinary.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler, asyncHandler } from './middleware/errorHandler.js';
import { sanitizeInput } from './utils/sanitizer.js';
import routes from './routes/index.js';
import MaintenanceService from './services/maintenanceService.js';
import { performanceMiddleware, paginationMiddleware } from './middleware/performanceMiddleware.js';
import { createRequestLogger } from './utils/structuredLogging.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { monitoringMiddleware } from './middleware/monitoring.js';
import { timeoutMiddleware } from './middleware/timeout.js';
import { defaultLimiter } from './middleware/rateLimiter.js';
import { alertService } from './services/alertService.js';
import healthRoutes from './routes/health.js';
import { secureHeadersMiddleware, corsConfiguration } from './middleware/securityHeaders.js';
import { preventSQLInjection, preventXSS } from './utils/sqlInjectionPrevention.js';
import { securityEnforcementStack } from './middleware/securityEnforcement.js';
import { authMiddleware } from './middleware/auth.js';
import { dataIsolationMiddleware } from './middleware/dataIsolation.js';

const app = express();
const config = getConfig();

function isPublicApiPath(path = '') {
  return (
    path === '/' ||
    path === '/health' ||
    path === '/api/v1/health' ||
    path === '/api/v1/orders/events/stream' ||
    /^\/api\/v1\/auth\/(login|staff\/login|register|token-info|forgot-password|reset-password|verify-otp|refresh-token|request-password-reset-otp|set-password-with-otp)/.test(path) ||
    /^\/api\/v1\/customer\//.test(path)
  );
}

// Trust proxy
app.set('trust proxy', 1);

// Request ID middleware (must be first)
app.use(requestIdMiddleware);

// Enable compression for all responses
app.use(compression());

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Cookie parser
app.use(cookieParser());

// Timeout middleware
app.use(timeoutMiddleware(30000)); // 30 second timeout

// CORS configuration - Open for all origins with credentials
app.use(cors({
  origin: true,
  credentials: true
}));
app.options('*', cors());

// Security headers middleware
app.use(secureHeadersMiddleware);

// Root endpoint (for Render health checks)
app.get('/', asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    service: 'restaurant-saas-api',
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}));

app.head('/', asyncHandler(async (req, res) => {
  res.status(200).end();
}));

// Health check endpoint (before monitoring)
app.get('/health', asyncHandler(async (req, res) => {
  res.status(200).json({ status: 'ok' });
}));

// Monitoring middleware (after health check)
app.use((req, res, next) => {
  if (req.path === '/health') {
    return next();
  }
  monitoringMiddleware(req, res, next);
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

// Global rate limiter (except health check and monitoring endpoints)
app.use((req, res, next) => {
  if (req.path === '/health' || req.path === '/api/health' || req.path === '/api/metrics' || req.path === '/api/alerts') {
    return next();
  }
  defaultLimiter(req, res, next);
});

// Performance monitoring middleware
app.use(performanceMiddleware);

// Pagination middleware
app.use(paginationMiddleware);

// Structured request logging middleware (tracks slow requests and errors)
app.use(createRequestLogger);

// Input sanitization middleware
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeInput(req.body);
  }
  next();
});

// SQL Injection prevention
app.use(preventSQLInjection);

// XSS prevention
app.use(preventXSS);

// ============================================
// COMPREHENSIVE SECURITY ENFORCEMENT
// ============================================
// 1. JWT Authentication (skip for public endpoints)
app.use((req, res, next) => {
  if (isPublicApiPath(req.path)) {
    return next();
  }
  
  authMiddleware(req, res, next);
});

// 2. Data Isolation (restaurant context) - skip for public endpoints
app.use((req, res, next) => {
  if (isPublicApiPath(req.path)) {
    return next();
  }
  
  dataIsolationMiddleware(req, res, next);
});

// 3-10. Security Enforcement Stack (RBAC, Input Validation, SQL Prevention, etc.)
securityEnforcementStack.forEach(middleware => {
  app.use((req, res, next) => {
    if (isPublicApiPath(req.path)) {
      return next();
    }
    
    middleware(req, res, next);
  });
});

// Routes
app.use('/api/v1/health', healthRoutes);
app.use('/api', routes);

// 404 handler
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

logger.info('✅ Express app configured successfully');

export default app;
