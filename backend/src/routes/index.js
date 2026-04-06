import express from 'express';
import authRoutes from './auth.js';
import restaurantRoutes from './restaurant.js';
import menuRoutes from './menu.js';
import orderRoutes from './order.js';
import kitchenRoutes from './kitchen.js';
import tableRoutes from './table.js';
import analyticsRoutes from './analytics.js';
import customerRoutes from './customer.js';
import inventoryRoutes from './inventory.js';
import takeawayRoutes from './takeaway.js';

const router = express.Router();

const apiVersion = process.env.API_VERSION || 'v1';

// Public/Auth routes
router.use(`/${apiVersion}/auth`, authRoutes);

// Customer routes (public)
router.use(`/${apiVersion}/customer`, customerRoutes);

// Protected routes
router.use(`/${apiVersion}/restaurants`, restaurantRoutes);
router.use(`/${apiVersion}/menu`, menuRoutes);
router.use(`/${apiVersion}/orders`, orderRoutes);
router.use(`/${apiVersion}/takeaway`, takeawayRoutes);
router.use(`/${apiVersion}/kitchen`, kitchenRoutes);
router.use(`/${apiVersion}/tables`, tableRoutes);
router.use(`/${apiVersion}/analytics`, analyticsRoutes);
router.use(`/${apiVersion}/inventory`, inventoryRoutes);

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default router;
