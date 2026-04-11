/**
 * CONTROLLER INTEGRATION GUIDE
 * 
 * This file shows how to update controllers to use:
 * 1. Pagination middleware
 * 2. Response optimization
 * 3. Cache management
 */

import logger from '../utils/logger.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import OrderService from '../services/orderService.js';
import { optimizeOrderResponse, stripDatabaseFields } from '../utils/responseOptimizer.js';
import { performanceMonitor } from '../utils/performanceMonitor.js';
import { cacheManager } from '../utils/cacheManager.js';

/**
 * EXAMPLE 1: Get Orders with Pagination
 * 
 * Usage:
 * GET /api/v1/orders?limit=20&offset=0
 * GET /api/v1/orders?limit=50&offset=50&status=completed
 */
export const getOrders = asyncHandler(async (req, res) => {
  const { limit, offset } = req.pagination;
  const filters = {
    status: req.query.status,
    tableId: req.query.tableId,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    limit,
    offset,
  };

  const orders = await OrderService.getOrdersByRestaurant(
    req.user.restaurantId,
    filters
  );

  return sendSuccess(
    res,
    200,
    optimizeOrderResponse(orders),
    'Orders fetched successfully',
    {
      pagination: {
        limit,
        offset,
        page: req.pagination.page,
        hasMore: orders.length === limit,
      },
    }
  );
});

/**
 * EXAMPLE 2: Get Order By ID with Optimization
 * 
 * Usage:
 * GET /api/v1/orders/:orderId
 */
export const getOrderById = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const order = await OrderService.getOrderById(
    req.user.restaurantId,
    orderId
  );

  return sendSuccess(
    res,
    200,
    optimizeOrderResponse(order),
    'Order fetched successfully'
  );
});

/**
 * EXAMPLE 3: Update Order with Cache Invalidation
 * 
 * Usage:
 * PATCH /api/v1/orders/:orderId/status
 * Body: { status: "completed" }
 */
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  if (!status) {
    return sendError(res, 400, 'Status is required');
  }

  const order = await OrderService.updateOrderStatus(
    req.user.restaurantId,
    orderId,
    status
  );

  // Cache is automatically invalidated by the service
  
  return sendSuccess(
    res,
    200,
    optimizeOrderResponse(order),
    `Order status updated to ${status}`
  );
});

/**
 * EXAMPLE 4: Kitchen Display with Real-time Caching
 * 
 * Usage:
 * GET /api/v1/kitchen/pending?limit=50&offset=0
 */
export const getPendingOrders = asyncHandler(async (req, res) => {
  const { limit, offset } = req.pagination;

  const orders = await KitchenService.getPendingOrders(
    req.user.restaurantId,
    limit,
    offset
  );

  return sendSuccess(
    res,
    200,
    optimizeOrderResponse(orders),
    'Pending orders fetched',
    {
      pagination: {
        limit,
        offset,
        hasMore: orders.length === limit,
      },
      cacheHitRate: performanceMonitor.getStats().cacheHitRate,
    }
  );
});

/**
 * EXAMPLE 5: Menu Items with Category Filtering
 * 
 * Usage:
 * GET /api/v1/menu/items?categoryId=123&limit=100&offset=0
 */
export const getMenuItems = asyncHandler(async (req, res) => {
  const { limit, offset } = req.pagination;
  const filters = {
    categoryId: req.query.categoryId,
    limit,
    offset,
  };

  const items = await MenuService.getMenuItems(
    req.user.restaurantId,
    filters
  );

  return sendSuccess(
    res,
    200,
    optimizeMenuItemResponse(items),
    'Menu items fetched successfully',
    {
      pagination: {
        limit,
        offset,
        hasMore: items.length === limit,
      },
    }
  );
});

/**
 * EXAMPLE 6: Analytics Dashboard with Caching
 * 
 * Usage:
 * GET /api/v1/analytics/summary?days=7
 */
export const getAnalyticsSummary = asyncHandler(async (req, res) => {
  const days = Math.min(parseInt(req.query.days) || 7, 30);

  const summary = await AnalyticsService.getAnalyticsSummary(
    req.user.restaurantId,
    days
  );

  return sendSuccess(
    res,
    200,
    stripDatabaseFields(summary),
    'Analytics summary fetched successfully',
    {
      cacheAge: '2 minutes', // Cached at service level
    }
  );
});

/**
 * EXAMPLE 7: Tables List with Pagination
 * 
 * Usage:
 * GET /api/v1/tables?status=available&limit=50&offset=0
 */
export const getTables = asyncHandler(async (req, res) => {
  const { limit, offset } = req.pagination;
  const filters = {
    status: req.query.status,
    location: req.query.location,
    limit,
    offset,
  };

  const tables = await TableService.getTablesByRestaurant(
    req.user.restaurantId,
    filters
  );

  return sendSuccess(
    res,
    200,
    optimizeTableResponse(tables),
    'Tables fetched successfully',
    {
      pagination: {
        limit,
        offset,
        hasMore: tables.length === limit,
      },
    }
  );
});

/**
 * PERFORMANCE STATS ENDPOINT (Development Only)
 * Shows current cache hit rates and performance metrics
 * 
 * Usage:
 * GET /api/v1/debug/performance-stats
 */
export const getPerformanceStats = asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return sendError(res, 403, 'Not available in production');
  }

  const stats = performanceMonitor.getStats();
  const cacheStats = cacheManager.getStats();

  return sendSuccess(res, 200, {
    performance: stats,
    cache: cacheStats,
    timestamp: new Date().toISOString(),
  });
});

/**
 * CACHE MANAGEMENT ENDPOINT (Development Only)
 * Clear cache for testing
 * 
 * Usage:
 * POST /api/v1/debug/clear-cache
 */
export const clearCache = asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return sendError(res, 403, 'Not available in production');
  }

  cacheManager.clear();
  performanceMonitor.resetMetrics();

  return sendSuccess(res, 200, {
    message: 'Cache and metrics cleared',
    timestamp: new Date().toISOString(),
  });
});

export default {
  getOrders,
  getOrderById,
  updateOrderStatus,
  getPendingOrders,
  getMenuItems,
  getAnalyticsSummary,
  getTables,
  getPerformanceStats,
  clearCache,
};
