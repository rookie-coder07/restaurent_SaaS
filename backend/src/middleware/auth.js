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

  return sendError(res, 500, 'Authentication error');
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
      throw new AppError('UNAUTHORIZED', 'No token provided');
    }
    req.user = verifyAccessToken(token);
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
    // Continue as unauthenticated
  }
  next();
};
