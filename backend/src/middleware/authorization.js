import { logWarn, logError } from '../utils/logger.js';

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
      });
    }

    const userRole = req.user.role?.toLowerCase();

    if (!allowedRoles.map(r => r.toLowerCase()).includes(userRole)) {
      logWarn('Unauthorized access attempt', {
        userId: req.user.id,
        userRole,
        allowedRoles,
        path: req.path,
        method: req.method,
        ip: req.ip,
      });

      return res.status(403).json({
        success: false,
        message: 'Access denied',
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
  // 🔥 CRITICAL: Normalize role (owner → admin)
  const normalizeRole = (role) => {
    if (!role) return null;
    const r = String(role).toLowerCase();
    if (r === "owner") return "admin";
    return r;
  };
  
  const normalizedRole = normalizeRole(req.user?.role);
  
  if (!['admin'].includes(normalizedRole)) {
    logWarn('Admin access denied', {
      userId: req.user?.id,
      userRole: req.user?.role,
      normalizedRole: normalizedRole,
      path: req.path,
      ip: req.ip,
    });

    return res.status(403).json({
      success: false,
      message: 'Access denied',
    });
  }

  next();
};

export const requireManager = (req, res, next) => {
  // 🔥 CRITICAL: Normalize role (owner → admin)
  const normalizeRole = (role) => {
    if (!role) return null;
    const r = String(role).toLowerCase();
    if (r === "owner") return "admin";
    return r;
  };
  
  const role = normalizeRole(req.user?.role);

  if (!['admin', 'manager'].includes(role)) {
    logWarn('Manager access denied', {
      userId: req.user?.id,
      userRole: req.user?.role,
      normalizedRole: role,
      path: req.path,
      ip: req.ip,
    });

    return res.status(403).json({
      success: false,
      message: 'Access denied',
    });
  }

  next();
};

export const requireRestaurant = (req, res, next) => {
  if (!req.user?.restaurantId) {
    logWarn('Restaurant ID missing', {
      userId: req.user?.id,
      path: req.path,
      ip: req.ip,
    });

    return res.status(403).json({
      success: false,
      message: 'Access denied',
    });
  }

  req.restaurantId = req.user.restaurantId;
  next();
};

export const validateRestaurantAccess = (req, res, next) => {
  const requestedRestaurantId = req.params.restaurantId || req.body?.restaurantId;

  if (requestedRestaurantId && req.user?.restaurantId && requestedRestaurantId !== req.user.restaurantId) {
    // 🔥 CRITICAL: Normalize role (owner → admin)
    const normalizeRole = (role) => {
      if (!role) return null;
      const r = String(role).toLowerCase();
      if (r === "owner") return "admin";
      return r;
    };
    
    const normalizedRole = normalizeRole(req.user?.role);
    
    if (!['admin'].includes(normalizedRole)) {
      logWarn('Cross-restaurant access denied', {
        userId: req.user.id,
        userRestaurantId: req.user.restaurantId,
        requestedRestaurantId,
        userRole: req.user?.role,
        normalizedRole: normalizedRole,
        path: req.path,
        ip: req.ip,
      });

      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }
  }

  next();
};

export const checkResourceOwnership = (resourceOwnerId) => {
  return (req, res, next) => {
    // 🔥 CRITICAL: Normalize role (owner → admin)
    const normalizeRole = (role) => {
      if (!role) return null;
      const r = String(role).toLowerCase();
      if (r === "owner") return "admin";
      return r;
    };
    
    const normalizedRole = normalizeRole(req.user?.role);
    
    if (!['admin'].includes(normalizedRole) && resourceOwnerId !== req.user?.id) {
      logWarn('Resource access denied', {
        userId: req.user?.id,
        resourceOwnerId,
        userRole: req.user?.role,
        normalizedRole: normalizedRole,
        path: req.path,
        ip: req.ip,
      });

      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    next();
  };
};
