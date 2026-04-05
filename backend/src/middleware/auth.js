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

  if (!VALID_ROLES.includes(normalizedRole)) {
    throw new AppError('UNAUTHORIZED', 'Invalid role in token');
  }

  return {
    userId: decoded.userId,
    restaurantId: decoded.restaurantId,
    email: decoded.email,
    role: normalizedRole,
  };
};

function handleAuthError(res, error) {
  if (error.name === 'TokenExpiredError') {
    return sendError(res, 401, 'Token has expired', { error: error.message });
  }

  if (error.name === 'JsonWebTokenError') {
    return sendError(res, 401, 'Invalid token', { error: error.message });
  }

  if (error instanceof AppError) {
    return sendError(res, error.statusCode, error.message);
  }

  logger.error('Auth middleware error:', error);
  return sendError(res, 401, 'Authentication failed');
}

export const authMiddleware = (req, res, next) => {
  try {
    const token = extractAuthToken(req);
    req.user = verifyAccessToken(token);
    logger.info(`Auth successful for user: ${req.user.email}`);
    next();
  } catch (error) {
    return handleAuthError(res, error);
  }
};

export const streamAuthMiddleware = (req, res, next) => {
  try {
    const token = extractAuthToken(req, { allowQuery: true });
    req.user = verifyAccessToken(token);
    logger.info(`Stream auth successful for user: ${req.user.email}`);
    next();
  } catch (error) {
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
    logger.debug('Optional auth failed, continuing as unauthenticated');
  }

  next();
};
