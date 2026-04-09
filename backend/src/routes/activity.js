import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getStaffList, getUserActivity, getUserInfo } from '../controllers/activityController.js';

const router = express.Router();

// All activity routes require authentication
router.use(authMiddleware);

// Get staff list
router.get('/staff', getStaffList);

// Get user info with stats
router.get('/:userId/info', getUserInfo);

// Get activity logs for a user
router.get('/:userId/logs', getUserActivity);

export default router;
