import { logWarn } from '../utils/logger.js';

export const dataIsolationMiddleware = (req, res, next) => {
  const isDeveloper = String(req.user?.role || '').toLowerCase() === 'developer';

  if (!req.user?.restaurantId && !isDeveloper) {
    logWarn('Restaurant ID missing for data isolation', {
      userId: req.user?.id,
      path: req.path,
      ip: req.ip,
    });

    return res.status(403).json({
      success: false,
      message: 'Access denied',
    });
  }

  req.restaurantId = req.user?.restaurantId || null;

  // Ensure all queries include restaurant filter (skip for developer)
  req.ensureRestaurantFilter = (query) => {
    if (!query) return null;
    if (isDeveloper) return query;
    if (query.eq) return query.eq('restaurant_id', req.restaurantId);
    return query;
  };

  next();
};

export const validateRestaurantOwnership = (requiredRestaurantId) => {
  return (req, res, next) => {
    if (!req.user?.restaurantId) {
      logWarn('No restaurant context', {
        path: req.path,
        ip: req.ip,
      });

      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Admins can access any restaurant
    if (req.user.role?.toLowerCase() === 'admin') {
      return next();
    }

    // Non-admins can only access their own restaurant
    if (requiredRestaurantId && requiredRestaurantId !== req.user.restaurantId) {
      logWarn('Cross-restaurant access attempt', {
        userId: req.user.id,
        userRestaurantId: req.user.restaurantId,
        requestedRestaurantId: requiredRestaurantId,
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

export const getRestaurantFilter = (restaurantId) => {
  return {
    eq: (field, value) => ({
      restaurant_id: restaurantId,
      [field]: value,
    }),
  };
};

// Ensure all database queries include restaurant_id filter
export const queryBuilder = (restaurantId) => {
  return {
    select: (fields) => ({
      restaurant_id: restaurantId,
      select: fields,
    }),
    where: (conditions) => ({
      restaurant_id: restaurantId,
      ...conditions,
    }),
  };
};
