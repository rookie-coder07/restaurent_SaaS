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
  if (error.name === 'TokenExpiredError') {
    return sendError(res, 401, 'Unauthorized access');
  }

  if (error.name === 'JsonWebTokenError') {
    return sendError(res, 401, 'Unauthorized access');
  }

  if (error instanceof AppError) {
    return sendError(res, error.statusCode, error.statusCode === 401 ? 'Unauthorized access' : error.message);
  }

  return sendError(res, 401, 'Unauthorized access');
}

export const authMiddleware = (req, res, next) => {
  try {
    const token = extractAuthToken(req);
    req.user = verifyAccessToken(token);
    next();
  } catch (error) {
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
