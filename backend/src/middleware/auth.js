import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';
import { AppError } from '../utils/errorCodes.js';
import { sendError } from '../utils/apiResponse.js';
import { normalizeRole, VALID_ROLES } from '../constants/index.js';

export const extractAuthToken = (req, { allowQuery = false } = {}) => {
  if (req.headers.authorization?.startsWith('Bearer ')) {
    return req.headers.authorization.substring(7);
  }

  if (req.cookies?.accessToken) {
    return req.cookies.accessToken;
  }

  if (allowQuery && typeof req.query?.accessToken === 'string' && req.query.accessToken.trim()) {
    return req.query.accessToken.trim();
  }

  return '';
};

export const verifyAccessToken = (token) => {
  if (!token) {
    throw new AppError('UNAUTHORIZED');
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const normalizedRole = normalizeRole(decoded.role);

  console.log('[VERIFY_TOKEN] Raw token:', {
    role: decoded.role,
    userId: decoded.userId,
    email: decoded.email,
  });

  console.log('[VERIFY_TOKEN] After normalization:', {
    normalizedRole,
    role: decoded.role,
    isValid: VALID_ROLES.includes(normalizedRole),
  });

  if (!VALID_ROLES.includes(normalizedRole)) {
    console.log('[VERIFY_TOKEN] ❌ Invalid role:', { normalizedRole, validRoles: VALID_ROLES });
    throw new AppError('UNAUTHORIZED', `Invalid role in token: ${normalizedRole}`);
  }

  // DEBUG: Log normalization
  if (decoded.role !== normalizedRole) {
    logger.info(`[ROLE_NORMALIZATION] ${decoded.role} → ${normalizedRole}`, {
      userId: decoded.userId,
      role: normalizedRole,
    });
  }

  console.log('[VERIFY_TOKEN] ✅ Token verified with role:', normalizedRole);

  return {
    userId: decoded.userId,
    id: decoded.userId,  // Alias for compatibility
    restaurantId: decoded.restaurantId,
    email: decoded.email,
    role: normalizedRole,
  };
};

function handleAuthError(res, error) {
  // Handle JWT library errors
  if (error.name === 'TokenExpiredError') {
    logger.warn('Token expired', { message: error.message });
    return sendError(res, 401, 'Token has expired. Please log in again.');
  }

  if (error.name === 'JsonWebTokenError') {
    logger.warn('JWT verification failed', { message: error.message });
    return sendError(res, 401, 'Invalid token. Please log in again.');
  }

  // Handle AppError from our error codes
  if (error instanceof AppError) {
    const statusCode = error.statusCode || 401;
    const message = error.message || 'Unauthorized access';
    logger.warn('Auth error:', { code: error.code, statusCode, message });
    return sendError(res, statusCode, message);
  }

  // Default to 401 for any other error
  logger.error('Unexpected auth error:', { error: error.message || error });
  return sendError(res, 401, 'Unauthorized access. Please log in again.');
}

export const authMiddleware = (req, res, next) => {
  try {
    const token = extractAuthToken(req);
    
    if (!token) {
      logger.warn('Auth middleware: No token found', {
        path: req.path,
        method: req.method,
        hasAuthHeader: !!req.headers.authorization,
        hasCookie: !!req.cookies?.accessToken,
        hasQueryToken: !!req.query?.accessToken,
      });
    }

    req.user = verifyAccessToken(token);
    
    logger.info('Auth middleware: User authenticated', {
      userId: req.user.userId,
      role: req.user.role,
      path: req.path,
    });
    
    next();
  } catch (error) {
    logger.error('Auth middleware error:', {
      message: error.message,
      path: req.path,
      method: req.method,
    });
    return handleAuthError(res, error);
  }
};

export const streamAuthMiddleware = (req, res, next) => {
  try {
    const token = extractAuthToken(req, { allowQuery: true });
    if (!token) {
      logger.warn('Event stream access denied - no token provided', { 
        path: req.path,
        query: req.query,
      });
      throw new AppError('UNAUTHORIZED', 'No token provided');
    }
    req.user = verifyAccessToken(token);
    logger.info('Event stream access granted', { userId: req.user.userId });
    next();
  } catch (error) {
    logger.error('Event stream auth failed', { error: error.message, path: req.path });
    return handleAuthError(res, error);
  }
};

export const optionalAuth = (req, res, next) => {
  try {
    const token = extractAuthToken(req);
    if (token) {
      req.user = verifyAccessToken(token);
    }
  } catch (error) {
    // Continue as unauthenticated
  }
  next();
};
