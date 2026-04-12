import { logWarn } from '../utils/logger.js';

export const dataIsolationMiddleware = (req, res, next) => {
  const isDeveloper = ['developer'].includes(req.user?.role);

  console.log('[DATA_ISOLATION]', { userId: req.user?.id, role: req.user?.role, isDeveloper, restaurantId: req.user?.restaurantId, path: req.path });

  if (!req.user?.restaurantId && !isDeveloper) {
    logWarn('Restaurant ID missing for non-developer', {
      userId: req.user?.id,
      role: req.user?.role,
      path: req.path,
      ip: req.ip,
    });

    return res.status(403).json({
      success: false,
      message: 'Restaurant access required',
      role: req.user?.role,
      isDeveloper: false,
    });
  }

  req.restaurantId = req.user?.restaurantId || null;

  // Ensure all queries include restaurant filter (skip for developer)
  req.ensureRestaurantFilter = (query) => {
    if (!query) return null;
    if (isDeveloper) {
      console.log('[QUERY_FILTER] Skipping restaurant_id filter for developer');
      return query;
    }
    console.log('[QUERY_FILTER] Adding restaurant_id filter for role:', req.user?.role, 'restaurantId:', req.restaurantId);
    if (query.eq) return query.eq('restaurant_id', req.restaurantId);
    return query;
  };

  next();
};

export const validateRestaurantOwnership = (requiredRestaurantId) => {
  return (req, res, next) => {
    const isDeveloper = ['developer'].includes(req.user?.role);

    console.log('[VALIDATE_OWNERSHIP]', { userId: req.user?.id, role: req.user?.role, isDeveloper, restaurantId: req.user?.restaurantId, requiredRestaurantId, path: req.path });

    //Developers can access any restaurant
    if (isDeveloper) {
      return next();
    }

    if (!req.user?.restaurantId) {
      logWarn('No restaurant context for non-developer', {
        userId: req.user?.id,
        role: req.user?.role,
        path: req.path,
        ip: req.ip,
      });

      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Admins can access any restaurant
    if (['admin'].includes(req.user.role)) {
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
