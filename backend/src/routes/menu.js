import express from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.js';
import { tenantIsolation, checkPermission, requireRole } from '../middleware/tenantIsolation.js';
import { validateRequest } from '../middleware/validation.js';
import {
  createMenuItemSchema,
  updateMenuItemSchema,
  createCategorySchema,
  updateCategorySchema,
  toggleAvailabilitySchema,
} from '../schemas/menu.schema.js';
import * as menuController from '../controllers/menuController.js';
import SecurityAuditLogger from '../utils/securityAudit.js';
import { sendError } from '../utils/apiResponse.js';

const router = express.Router();
const bulkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const fileName = String(file.originalname || '').toLowerCase();
    if (fileName.endsWith('.csv') || fileName.endsWith('.xlsx')) {
      callback(null, true);
      return;
    }

    callback(new Error('Only CSV and XLSX files are supported'));
  },
});

// All routes protected
router.use(authMiddleware, tenantIsolation);

// Category routes
router.post('/categories', requireRole(['owner']), checkPermission(['create_menu']), validateRequest(createCategorySchema), menuController.createCategory);
router.get('/categories', checkPermission(['view_orders', 'manage_menu']), menuController.getCategories);
router.put('/categories/:categoryId', requireRole(['owner']), checkPermission(['manage_menu']), validateRequest(updateCategorySchema), menuController.updateCategory);
router.delete('/categories/:categoryId', requireRole(['owner']), checkPermission(['manage_menu']), async (req, res, next) => {
  try {
    // ✅ Call controller
    await menuController.deleteCategory(req, res, next);
    
    // ✅ Log critical operation if successful
    if (res.statusCode === 200) {
      SecurityAuditLogger.logCriticalOperation(
        req.user?.id || 'unknown',
        'category_deletion',
        {
          categoryId: req.params.categoryId,
          restaurantId: req.restaurantId
        },
        req.ip
      );
    }
  } catch (error) {
    next(error);
  }
});

// Menu item routes
router.post('/bulk-upload', requireRole(['owner', 'manager']), (req, res, next) => {
  bulkUpload.single('file')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      sendError(res, 413, 'File exceeds 5MB limit');
      return;
    }

    sendError(res, 400, error.message || 'Unable to process upload');
  });
}, menuController.bulkUploadMenu);
router.post('/items', requireRole(['owner']), checkPermission(['create_menu']), validateRequest(createMenuItemSchema), async (req, res, next) => {
  try {
    // ✅ Additional validation for suspicious prices
    if (req.body.price < 0 || req.body.price > 999999) {
      SecurityAuditLogger.logSuspiciousActivity(
        req.user?.id || 'unknown',
        'invalid_menu_price',
        {
          price: req.body.price,
          itemName: req.body.name
        },
        req.ip
      );
      return res.status(400).json({
        success: false,
        message: 'Invalid menu item price'
      });
    }
    next();
  } catch (error) {
    next(error);
  }
}, menuController.createMenuItem);
router.get('/items', checkPermission(['view_orders', 'manage_menu']), menuController.getMenuItems);
router.get('/items/:itemId', checkPermission(['view_orders', 'manage_menu']), menuController.getMenuItemById);
router.put('/items/:itemId', requireRole(['owner']), checkPermission(['manage_menu']), validateRequest(updateMenuItemSchema), async (req, res, next) => {
  try {
    // ✅ Validate price if provided
    if (req.body.price && (req.body.price < 0 || req.body.price > 999999)) {
      SecurityAuditLogger.logSuspiciousActivity(
        req.user?.id || 'unknown',
        'invalid_menu_price_update',
        {
          price: req.body.price,
          itemId: req.params.itemId
        },
        req.ip
      );
      return res.status(400).json({
        success: false,
        message: 'Invalid menu item price'
      });
    }
    next();
  } catch (error) {
    next(error);
  }
}, menuController.updateMenuItem);
router.delete('/items/:itemId', requireRole(['owner']), checkPermission(['manage_menu']), async (req, res, next) => {
  try {
    // ✅ Call controller
    await menuController.deleteMenuItem(req, res, next);
    
    // ✅ Log critical operation if successful
    if (res.statusCode === 200) {
      SecurityAuditLogger.logCriticalOperation(
        req.user?.id || 'unknown',
        'menu_item_deletion',
        {
          itemId: req.params.itemId,
          restaurantId: req.restaurantId
        },
        req.ip
      );
    }
  } catch (error) {
    next(error);
  }
});
router.patch('/items/:itemId/availability', requireRole(['owner']), checkPermission(['manage_menu']), validateRequest(toggleAvailabilitySchema), menuController.toggleItemAvailability);

export default router;
