import { logWarn, logError } from '../utils/logger.js';
import { normalizeRole } from '../constants/index.js';

export const authorize = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      logWarn('Authorization check without user', {
        path: req.path,
        ip: req.ip,
      });

      return res.status(401).json({
        success: false,
        message: 'Unauthorized access',
        role: null,
      });
    }

    const normalizedRole = normalizeRole(req.user.role);

    if (!allowedRoles.map(normalizeRole).includes(normalizedRole)) {
      logWarn('Unauthorized access attempt', {
        userId: req.user.id,
        userRole: req.user.role,
        normalizedRole,
        allowedRoles,
        path: req.path,
        method: req.method,
        ip: req.ip,
      });

      return res.status(403).json({
        success: false,
        message: 'Access denied',
        role: normalizedRole,
      });
    }

    next();
  };
};

export const requireRole = (role) => {
  return authorize([role]);
};

export const requireAnyRole = (roles) => {
  return authorize(roles);
};

export const requireAdmin = (req, res, next) => {
  const normalizedRole = normalizeRole(req.user?.role);
  
  if (!['admin'].includes(normalizedRole)) {
    logWarn('Admin access denied', {
      userId: req.user?.id,
      userRole: req.user?.role,
      normalizedRole,
      path: req.path,
      ip: req.ip,
    });

    return res.status(403).json({
      success: false,
      message: 'Access denied',
      role: normalizedRole,
    });
  }

  next();
};

export const requireManager = (req, res, next) => {
  const normalizedRole = normalizeRole(req.user?.role);
  console.log('[REQUIRE_MANAGER]', { userRole: req.user?.role, normalizedRole });

  if (!['admin', 'manager', 'developer'].includes(normalizedRole)) {
    logWarn('Manager access denied', {
      userId: req.user?.id,
      userRole: req.user?.role,
      normalizedRole,
      path: req.path,
      ip: req.ip,
    });

    return res.status(403).json({
      success: false,
      message: 'Access denied',
      role: normalizedRole,
    });
  }

  next();
};

export const requireDeveloper = (req, res, next) => {
  const normalizedRole = normalizeRole(req.user?.role);
  
  if (normalizedRole !== 'developer') {
    logWarn('Developer access denied', {
      userId: req.user?.id,
      userRole: req.user?.role,
      normalizedRole,
      path: req.path,
      ip: req.ip,
    });

    return res.status(403).json({
      success: false,
      message: 'Access denied',
      role: normalizedRole,
    });
  }

  next();
};

export const requireRestaurant = (req, res, next) => {
  const normalizedRole = normalizeRole(req.user?.role);
  const isDeveloper = normalizedRole === 'developer';

  console.log('[REQUIRE_RESTAURANT]', { userId: req.user?.id, role: req.user?.role, isDeveloper, hasRestaurantId: !!req.user?.restaurantId, path: req.path });

  // Developers don't need a restaurant_id
  if (isDeveloper) {
    req.restaurantId = null;
    return next();
  }

  if (!req.user?.restaurantId) {
    logWarn('Restaurant ID missing for non-developer', {
      userId: req.user?.id,
      role: normalizedRole,
      path: req.path,
      ip: req.ip,
    });

    return res.status(403).json({
      success: false,
      message: 'Restaurant access required',
      role: normalizedRole,
    });
  }

  req.restaurantId = req.user.restaurantId;
  next();
};

export const validateRestaurantAccess = (req, res, next) => {
  const requestedRestaurantId = req.params.restaurantId || req.body?.restaurantId;
  const normalizedRole = normalizeRole(req.user?.role);
  const isDeveloper = normalizedRole === 'developer';

  console.log('[VALIDATE_ACCESS]', { userId: req.user?.id, role: normalizedRole, isDeveloper, userRestaurantId: req.user?.restaurantId, requestedRestaurantId, path: req.path });

  // Developers can access any restaurant
  if (isDeveloper) {
    return next();
  }

  if (requestedRestaurantId && req.user?.restaurantId && requestedRestaurantId !== req.user.restaurantId) {
    if (!['admin'].includes(normalizedRole)) {
      logWarn('Cross-restaurant access denied', {
        userId: req.user.id,
        userRestaurantId: req.user.restaurantId,
        requestedRestaurantId,
        userRole: req.user?.role,
        normalizedRole,
        path: req.path,
        ip: req.ip,
      });

      return res.status(403).json({
        success: false,
        message: 'Access denied',
        role: normalizedRole,
      });
    }
  }

  next();
};

export const checkResourceOwnership = (resourceOwnerId) => {
  return (req, res, next) => {
    const normalizedRole = normalizeRole(req.user?.role);
    const isDeveloper = normalizedRole === 'developer';

    console.log('[CHECK_OWNERSHIP]', { userId: req.user?.id, role: normalizedRole, isDeveloper, resourceOwnerId, path: req.path });
    
    // Developers can access any resource
    if (isDeveloper) {
      return next();
    }
    
    if (!['admin'].includes(normalizedRole) && resourceOwnerId !== req.user?.id) {
      logWarn('Resource access denied', {
        userId: req.user?.id,
        resourceOwnerId,
        userRole: req.user?.role,
        normalizedRole,
        path: req.path,
        ip: req.ip,
      });

      return res.status(403).json({
        success: false,
        message: 'Access denied',
        role: normalizedRole,
      });
    }

    next();
  };
};
