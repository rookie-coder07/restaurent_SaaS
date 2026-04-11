import logger from '../utils/logger.js';
import { sendError } from '../utils/apiResponse.js';
import { normalizeRole, ROLE_PERMISSIONS } from '../constants/index.js';

export const tenantIsolation = (req, res, next) => {
  try {
    if (!req.user) {
      return sendError(res, 401, 'Unauthorized');
    }

    if (normalizeRole(req.user.role) === 'developer') {
      // Developers can operate across restaurants; keep optional restaurantId if provided, but do not enforce.
      req.restaurantId =
        req.headers['x-restaurant-id'] ||
        req.body?.restaurantId ||
        req.params?.restaurantId ||
        req.query?.restaurantId ||
        null;
      return next();
    }

    req.restaurantId = req.user.restaurantId;

    if (!req.restaurantId) {
      return sendError(res, 400, 'Restaurant ID not found in token');
    }

    const requestRestaurantId =
      req.headers['x-restaurant-id'] ||
      req.body?.restaurantId ||
      req.params?.restaurantId ||
      req.query?.restaurantId;

    if (requestRestaurantId && String(requestRestaurantId) !== String(req.restaurantId)) {
      logger.warn(`Tenant boundary violation attempt by user ${req.user.email}`);
      return sendError(res, 403, 'Cannot access other restaurants data');
    }

    logger.info(`Tenant isolation applied for: ${req.restaurantId}`);
    next();
  } catch (error) {
    logger.error('Tenant isolation error:', error);
    return sendError(res, 500, 'Tenant isolation failed');
  }
};

export const checkPermission = (requiredPermissions = []) => {
  return (req, res, next) => {
    try {
      const userRole = req.user?.role;
      const normalizedRole = normalizeRole(userRole);

      if (!normalizedRole) {
        return sendError(res, 401, 'User role not found');
      }

      const userPermissions = ROLE_PERMISSIONS[normalizedRole] || [];
      const hasPermission =
        requiredPermissions.length === 0 ||
        requiredPermissions.some((perm) => userPermissions.includes(perm));

      if (!hasPermission) {
        logger.warn(`Permission denied for user ${req.user.email} with role ${normalizedRole}`);
        return sendError(res, 403, 'Insufficient permissions for this action', {
          requiredPermissions,
          userRole: normalizedRole,
        });
      }

      next();
    } catch (error) {
      logger.error('Permission check error:', error);
      return sendError(res, 500, 'Permission check failed');
    }
  };
};

export const requireRole = (allowedRoles = []) => {
  return (req, res, next) => {
    try {
      const userRole = req.user?.role;
      const normalizedRole = normalizeRole(userRole);

      if (!normalizedRole) {
        return sendError(res, 401, 'User role not found');
      }

      if (!allowedRoles.map(normalizeRole).includes(normalizedRole)) {
        logger.warn(`Role denied for user ${req.user.email} with role ${normalizedRole}`);
        return sendError(res, 403, 'This action is restricted to a different account role', {
          allowedRoles,
          userRole: normalizedRole,
        });
      }

      next();
    } catch (error) {
      logger.error('Role check error:', error);
      return sendError(res, 500, 'Role check failed');
    }
  };
};

export const requireAdminAccess = () => requireRole(['owner']);
export const requireDeveloperAccess = () => requireRole(['developer']);

export const requireBillingRole = () => {
  return (req, res, next) => {
    try {
      const normalizedRole = normalizeRole(req.user?.role);

      if (normalizedRole !== 'owner' && normalizedRole !== 'manager') {
        logger.warn(`Billing action denied for user ${req.user?.email} with role ${normalizedRole}`);
        return sendError(res, 403, 'Unauthorized: Only manager can perform billing actions');
      }

      next();
    } catch (error) {
      logger.error('Billing role check error:', error);
      return sendError(res, 500, 'Billing role check failed');
    }
  };
};

export const requireOwnerRole = () => {
  return (req, res, next) => {
    try {
      const normalizedRole = normalizeRole(req.user?.role);

      if (normalizedRole !== 'owner') {
        logger.warn(`Owner action denied for user ${req.user?.email} with role ${normalizedRole}`);
        return sendError(res, 403, 'Unauthorized: Only admin can perform this action');
      }

      next();
    } catch (error) {
      logger.error('Owner role check error:', error);
      return sendError(res, 500, 'Owner role check failed');
    }
  };
};

export const verifyRequestRestaurantId = (req, res, next) => {
  try {
    const requestRestaurantId =
      req.headers['x-restaurant-id'] ||
      req.body?.restaurantId ||
      req.params?.restaurantId ||
      req.query?.restaurantId;

    if (requestRestaurantId && String(requestRestaurantId) !== String(req.restaurantId)) {
      logger.warn(`Tenant boundary violation attempt by user ${req.user.email}`);
      return sendError(res, 403, 'Cannot access other restaurants data');
    }

    next();
  } catch (error) {
    logger.error('Restaurant verification error:', error);
    return sendError(res, 500, 'Restaurant verification failed');
  }
};
