import logger from '../utils/logger.js';
import { sendError } from '../utils/apiResponse.js';

/**
 * COMPREHENSIVE SECURITY ENFORCEMENT MIDDLEWARE
 * Implements all 10 security requirements:
 * 1. JWT Authentication
 * 2. RBAC Authorization
 * 3. Input Validation
 * 4. SQL Injection Prevention
 * 5. Rate Limiting
 * 6. CORS
 * 7. Safe Error Handling
 * 8. Data Isolation
 * 9. Password Security
 * 10. Activity Logging
 */

// 1. JWT AUTHENTICATION - Validate on every request
export const enforceJWTAuthentication = (req, res, next) => {
  const isPublic = (
    req.path === '/health' ||
    req.path === '/api/v1/health' ||
    req.path.match(/^\/api\/v1\/auth\/(login|register|token-info|forgot-password|reset-password|verify-otp|debug-test)/)
  );
  
  if (isPublic) {
    return next();
  }

  if (!req.user) {
    logger.warn('Unauthorized access attempt', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });
    return sendError(res, 401, 'Unauthorized access');
  }

  const isDeveloper = String(req.user?.role || '').toLowerCase() === 'developer';

  if (!req.user.userId || (!req.user.restaurantId && !isDeveloper)) {
    logger.warn('Invalid token payload', {
      userId: req.user.userId,
      restaurantId: req.user.restaurantId,
      role: req.user.role,
      ip: req.ip,
    });
      return sendError(res, 401, 'Unauthorized access');
  }

  next();
};

// 2. RBAC ENFORCEMENT - Admin → full, Manager → limited, Waiter → restricted
export const enforceRBAC = (req, res, next) => {
  const isPublic = (
    req.path === '/health' ||
    req.path === '/api/v1/health' ||
    req.path.match(/^\/api\/v1\/auth\/(login|register|token-info|forgot-password|reset-password|verify-otp|debug-test)/)
  );
  
  if (isPublic) {
    return next();
  }

  const adminOnlyPaths = ['/api/developer', '/api/restaurant'];
  const managerPaths = ['/api/inventory', '/api/analytics'];
  const restrictedPaths = ['/api/order', '/api/table', '/api/kitchen'];

  const userRole = req.user?.role?.toLowerCase();

  if (adminOnlyPaths.some(path => req.path.startsWith(path))) {
    if (userRole !== 'admin') {
      logger.warn('Admin access denied', {
        userId: req.user?.id,
        role: userRole,
        path: req.path,
        ip: req.ip,
      });
      return sendError(res, 403, 'Access denied');
    }
  }

  if (managerPaths.some(path => req.path.startsWith(path))) {
    if (!['admin', 'manager'].includes(userRole)) {
      logger.warn('Manager access denied', {
        userId: req.user?.id,
        role: userRole,
        path: req.path,
        ip: req.ip,
      });
      return sendError(res, 403, 'Access denied');
    }
  }

  if (restrictedPaths.some(path => req.path.startsWith(path))) {
    if (!['admin', 'manager', 'waiter'].includes(userRole)) {
      logger.warn('Waiter access denied', {
        userId: req.user?.id,
        role: userRole,
        path: req.path,
        ip: req.ip,
      });
      return sendError(res, 403, 'Access denied');
    }
  }

  next();
};

// 3. INPUT VALIDATION - Reject invalid orderId, tableId, amounts
export const enforceInputValidation = (req, res, next) => {
  const body = req.body || {};

  // Validate orderId
  if (body.orderId !== undefined) {
    if (!Number.isInteger(body.orderId) || body.orderId <= 0) {
      logger.warn('Invalid orderId format', { orderId: body.orderId, ip: req.ip });
      return sendError(res, 400, 'Invalid request data');
    }
  }

  // Validate tableId
  if (body.tableId !== undefined) {
    if (!Number.isInteger(body.tableId) || body.tableId <= 0) {
      logger.warn('Invalid tableId format', { tableId: body.tableId, ip: req.ip });
      return sendError(res, 400, 'Invalid request data');
    }
  }

  // Validate amounts
  if (body.amount !== undefined) {
    if (typeof body.amount !== 'number' || body.amount < 0 || !isFinite(body.amount)) {
      logger.warn('Invalid amount', { amount: body.amount, ip: req.ip });
      return sendError(res, 400, 'Invalid request data');
    }
  }

  if (body.totalAmount !== undefined) {
    if (typeof body.totalAmount !== 'number' || body.totalAmount < 0 || !isFinite(body.totalAmount)) {
      logger.warn('Invalid totalAmount', { totalAmount: body.totalAmount, ip: req.ip });
      return sendError(res, 400, 'Invalid request data');
    }
  }

  // Validate discount (0-100%)
  if (body.discount !== undefined) {
    if (typeof body.discount !== 'number' || body.discount < 0 || body.discount > 100) {
      logger.warn('Invalid discount', { discount: body.discount, ip: req.ip });
      return sendError(res, 400, 'Invalid request data');
    }
  }

  next();
};

// Simple role guard
export const requireRole = (allowedRoles = []) => (req, res, next) => {
  const role = String(req.user?.role || '').toLowerCase();
  if (!allowedRoles.includes(role)) {
    return sendError(res, 403, 'Access denied');
  }
  return next();
};

// 4. SQL INJECTION PROTECTION - Enforce parameterized queries (via Supabase)
export const enforceSQLSafety = (req, res, next) => {
  // Ensure no raw SQL concatenation attempts
  const dangerousPatterns = [
    /select\s+\*/i,
    /drop\s+table/i,
    /delete\s+from/i,
    /update\s+.*set/i,
    /union\s+select/i,
  ];

  const bodyString = JSON.stringify(req.body || {});
  const queryString = JSON.stringify(req.query || {});

  for (const pattern of dangerousPatterns) {
    if (pattern.test(bodyString) || pattern.test(queryString)) {
      logger.warn('SQL injection attempt detected', {
        ip: req.ip,
        path: req.path,
        userId: req.user?.id,
        timestamp: new Date().toISOString(),
      });
      return sendError(res, 400, 'Invalid request data');
    }
  }

  next();
};

// 5. RATE LIMITING - Already handled by express-rate-limit middleware
// This is a reminder that rate limiting is enforced in app.js

// 6. CORS ENFORCEMENT - Verify origin in security headers middleware
// Already enforced in securityHeaders.js

// 7. SAFE ERROR HANDLING - No stack traces in responses
export const enforceSafeErrorHandling = (err, req, res, next) => {
  const isProduction = process.env.NODE_ENV === 'production';

  logger.error('Request error', {
    message: err.message,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    ip: req.ip,
    timestamp: new Date().toISOString(),
    ...(isProduction ? {} : { stack: err.stack }),
  });

  if (isProduction) {
    // Don't expose error details in production
    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.',
    });
  }

  // Development: include error details
  res.status(err.statusCode || 500).json({
    success: false,
      message: 'Something went wrong. Please try again.',
    ...(err.details && { details: err.details }),
  });
};

// 8. DATA ISOLATION - Filter by restaurant_id
export const enforceDataIsolation = (req, res, next) => {
  if (!req.user) {
    return next();
  }

  const userRestaurantId = req.user.restaurantId;
  const normalizedRole = String(req.user?.role || '').toLowerCase();
  const globalRole = normalizedRole === 'admin' || normalizedRole === 'developer';

  req.ensureRestaurantFilter = (supabaseQuery) => {
    if (globalRole) {
      return supabaseQuery;
    }
    return supabaseQuery.eq('restaurant_id', userRestaurantId);
  };

  // Prevent accessing other restaurants' data via query params
  if (req.query.restaurantId && req.query.restaurantId !== userRestaurantId && !globalRole) {
    logger.warn('Cross-restaurant access attempt', {
      userId: req.user.id,
      userRestaurantId,
      requestedRestaurantId: req.query.restaurantId,
      role: normalizedRole,
      ip: req.ip,
    });
    return sendError(res, 403, 'Access denied');
  }

  next();
};

// 9. PASSWORD SECURITY - Enforce on auth routes
export const enforcePasswordSecurity = (req, res, next) => {
  if (!req.path.includes('/auth/')) {
    return next();
  }

  const password = req.body?.password || req.body?.newPassword;

  if (password) {
    const minLength = 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*]/.test(password);

    if (password.length < minLength) {
      return sendError(res, 400, 'Invalid request data');
    }

    if (!hasUppercase) {
      return sendError(res, 400, 'Invalid request data');
    }

    if (!hasLowercase) {
      return sendError(res, 400, 'Invalid request data');
    }

    if (!hasNumbers) {
      return sendError(res, 400, 'Invalid request data');
    }

    if (!hasSpecialChar) {
      return sendError(res, 400, 'Invalid request data');
    }
  }

  next();
};

// 10. ACTIVITY LOGGING - Log suspicious activity
export const enforceActivityLogging = (req, res, next) => {
  const sensitiveOperations = ['POST', 'PUT', 'DELETE'];
  const criticalPaths = ['/api/developer', '/api/restaurant', '/api/order/settle', '/auth/register'];

  if (sensitiveOperations.includes(req.method)) {
    const isCritical = criticalPaths.some(path => req.path.includes(path));

    if (isCritical) {
      logger.warn('Sensitive operation detected', {
        operation: `${req.method} ${req.path}`,
        userId: req.user?.id,
        role: req.user?.role,
        ip: req.ip,
        timestamp: new Date().toISOString(),
        body: req.method === 'DELETE' ? 'REDACTED' : req.body,
      });
    }
  }

  // Log failed authentications
  if (req.path.includes('/auth/login') && req.method === 'POST') {
    res.on('finish', () => {
      if (res.statusCode !== 200) {
        logger.warn('Failed login attempt', {
          email: req.body?.email,
          ip: req.ip,
          statusCode: res.statusCode,
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  next();
};

/**
 * MIDDLEWARE EXPORT
 * Apply in order: JWT → RBAC → Input Validation → SQL Safety → Data Isolation
 */
export const securityEnforcementStack = [
  enforceJWTAuthentication,
  enforceRBAC,
  enforceInputValidation,
  enforceSQLSafety,
  enforceDataIsolation,
  enforcePasswordSecurity,
  enforceActivityLogging,
];

export default securityEnforcementStack;
