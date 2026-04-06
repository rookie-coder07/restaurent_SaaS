import express from 'express';
import { validateRequest } from '../middleware/validation.js';
import { authLimiter } from '../middleware/rateLimit.js';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
  requestPasswordResetSchema,
} from '../schemas/auth.schema.js';
import * as authController from '../controllers/authController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/register', authLimiter, validateRequest(registerSchema), authController.registerRestaurant);
router.post('/login', authLimiter, validateRequest(loginSchema), authController.loginRestaurant);
router.post('/staff/login', authLimiter, validateRequest(loginSchema), authController.loginStaff);
router.post('/refresh-token', validateRequest(refreshTokenSchema), authController.refreshToken);
router.post('/request-password-reset', authLimiter, validateRequest(requestPasswordResetSchema), authController.requestPasswordReset);

// Protected routes
router.post('/logout', authMiddleware, authController.logout);
router.post('/change-password', authMiddleware, validateRequest(changePasswordSchema), authController.changePassword);
router.get('/me', authMiddleware, authController.getCurrentUser);

export default router;
