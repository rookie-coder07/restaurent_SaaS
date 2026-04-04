import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';
import { AppError } from '../utils/errorCodes.js';
import { sendError } from '../utils/apiResponse.js';
import { normalizeRole, VALID_ROLES } from '../constants/index.js';

export const authMiddleware = (req, res, next) => {
  try {
    // Get token from cookies or Authorization header
    let token = '';
    
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      throw new AppError('UNAUTHORIZED');
    }

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const normalizedRole = normalizeRole(decoded.role);

    if (!VALID_ROLES.includes(normalizedRole)) {
      return sendError(res, 401, 'Invalid role in token');
    }
    
    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      restaurantId: decoded.restaurantId,
      email: decoded.email,
      role: normalizedRole,
    };

    logger.info(`Auth successful for user: ${decoded.email}`);
    next();
  } catch (error) {
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
};

export const optionalAuth = (req, res, next) => {
  try {
    let token = '';
    
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const normalizedRole = normalizeRole(decoded.role);

      if (!VALID_ROLES.includes(normalizedRole)) {
        return next();
      }

      req.user = {
        userId: decoded.userId,
        restaurantId: decoded.restaurantId,
        email: decoded.email,
        role: normalizedRole,
      };
    }
  } catch (error) {
    logger.debug('Optional auth failed, continuing as unauthenticated');
  }

  next();
};
