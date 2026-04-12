import logger from '../utils/logger.js';
import { sendError } from '../utils/apiResponse.js';
import { normalizeRole, ROLE_PERMISSIONS } from '../constants/index.js';

export const tenantIsolation = (req, res, next) => {
  try {
    console.log('[TENANT_ISOLATION] Checking:', { 
      path: req.path,
      url: req.url,
      userRestaurantId: req.user?.restaurantId,
      userEmail: req.user?.email 
    });

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
      console.log('[TENANT_ISOLATION] ✅ Developer bypass, restaurantId:', req.restaurantId);
      return next();
    }

    req.restaurantId = req.user.restaurantId;

    if (!req.restaurantId) {
      console.log('[TENANT_ISOLATION] ❌ No restaurantId in user');
      return sendError(res, 400, 'Restaurant ID not found in token');
    }

    const requestRestaurantId =
      req.headers['x-restaurant-id'] ||
      req.body?.restaurantId ||
      req.params?.restaurantId ||
      req.query?.restaurantId;

    if (requestRestaurantId && String(requestRestaurantId) !== String(req.restaurantId)) {
      console.log('[TENANT_ISOLATION] ❌ TENANT BOUNDARY VIOLATION!');
      console.log('[TENANT_ISOLATION] Requested restaurantId:', requestRestaurantId);
      console.log('[TENANT_ISOLATION] User restaurantId:', req.restaurantId);
      logger.warn(`Tenant boundary violation attempt by user ${req.user.email}`);
      return sendError(res, 403, 'Cannot access other restaurants data');
    }

    console.log('[TENANT_ISOLATION] ✅ Tenant isolation passed, restaurantId:', req.restaurantId);
    logger.info(`Tenant isolation applied for: ${req.restaurantId}`);
    next();
  } catch (error) {
    console.log('[TENANT_ISOLATION] ❌ Error:', error.message);
    logger.error('Tenant isolation error:', error);
    return sendError(res, 500, 'Tenant isolation failed');
  }
};

export const checkPermission = (requiredPermissions = []) => {
  return (req, res, next) => {
    try {
      const userRole = req.user?.role;
      const userEmail = req.user?.email;
      const normalizedRole = normalizeRole(userRole);

      console.log('\n[CHECK_PERMISSION] ═══════════════════════════════════');
      console.log('[CHECK_PERMISSION] 🔍 CHECKING PERMISSION');
      console.log('[CHECK_PERMISSION] Path:', req.path);
      console.log('[CHECK_PERMISSION] User:', userEmail);
      console.log('[CHECK_PERMISSION] Raw Role:', userRole, '→ Normalized:', normalizedRole);
      console.log('[CHECK_PERMISSION] Required Permissions:', requiredPermissions);

      if (!normalizedRole) {
        console.log('[CHECK_PERMISSION] ❌ NO ROLE FOUND - returning 401');
        return sendError(res, 401, 'User role not found');
      }

      // DEBUG: Print all available roles in ROLE_PERMISSIONS
      const availableRoles = Object.keys(ROLE_PERMISSIONS);
      console.log('[CHECK_PERMISSION] Available roles in ROLE_PERMISSIONS:', availableRoles);
      
      const userPermissions = ROLE_PERMISSIONS[normalizedRole] || [];
      console.log('[CHECK_PERMISSION] ROLE_PERMISSIONS["' + normalizedRole + '"]:', userPermissions);

      // If no permissions defined for this role, it's an error
      if (!ROLE_PERMISSIONS.hasOwnProperty(normalizedRole)) {
        console.log('[CHECK_PERMISSION] ❌ ROLE NOT IN ROLE_PERMISSIONS:', normalizedRole);
        return sendError(res, 403, 'Role not recognized', {
          normalizedRole,
          availableRoles,
        });
      }

      const hasPermission = requiredPermissions.length === 0 || requiredPermissions.some((perm) => userPermissions.includes(perm));
      
      console.log('[CHECK_PERMISSION] Has Permission?', hasPermission);

      if (!hasPermission) {
        console.log('[CHECK_PERMISSION] ❌ PERMISSION DENIED');
        console.log('[CHECK_PERMISSION] Required:', requiredPermissions);
        console.log('[CHECK_PERMISSION] User has:', userPermissions);
        return sendError(res, 403, 'Insufficient permissions for this action', {
          requiredPermissions,
          userRole: normalizedRole,
          userPermissions,
        });
      }

      console.log('[CHECK_PERMISSION] ✅ PERMISSION GRANTED');
      console.log('[CHECK_PERMISSION] ═══════════════════════════════════\n');
      next();
    } catch (error) {
      console.log('[CHECK_PERMISSION] ❌ ERROR:', error.message);
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

// 🔥 CRITICAL: requireAdminAccess should check for 'admin' only (owner normalizes to admin)
export const requireAdminAccess = () => requireRole(['admin']);
export const requireDeveloperAccess = () => requireRole(['developer']);

export const requireBillingRole = () => {
  return (req, res, next) => {
    try {
      const normalizedRole = normalizeRole(req.user?.role);

      // 🔥 CRITICAL: After normalization, owner becomes admin
      // So we only need to check for the normalized roles
      if (!['admin', 'manager'].includes(normalizedRole)) {
        logger.warn(`Billing action denied for user ${req.user?.email} with role ${normalizedRole}`);
        return sendError(res, 403, 'Unauthorized: Only manager or admin can perform billing actions');
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

      // 🔥 CRITICAL: After normalization, owner becomes admin
      // So we only check for 'admin' here
      if (normalizedRole !== 'admin') {
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
