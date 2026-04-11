import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getStaffList, getUserActivity, getUserInfo } from '../controllers/activityController.js';
import SecurityAuditLogger from '../utils/securityAudit.js';

const router = express.Router();

// All activity routes require authentication
router.use(authMiddleware);

// Get staff list
router.get('/staff', (req, res, next) => {
  // ✅ Log data access
  SecurityAuditLogger.logDataAccess(
    req.user?.id || 'unknown',
    'staff',
    'list_view',
    req.ip
  );
  next();
}, getStaffList);

// Get user info with stats
router.get('/:userId/info', (req, res, next) => {
  // ✅ Log data access
  SecurityAuditLogger.logDataAccess(
    req.user?.id || 'unknown',
    'user',
    'info_view',
    req.ip
  );
  next();
}, getUserInfo);

// Get activity logs for a user
router.get('/:userId/logs', (req, res, next) => {
  // ✅ Log audit access
  SecurityAuditLogger.logDataAccess(
    req.user?.id || 'unknown',
    'activity_logs',
    'view',
    req.ip
  );
  next();
}, getUserActivity);

export default router;
