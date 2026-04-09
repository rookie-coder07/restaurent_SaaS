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
import * as passwordResetController from '../controllers/passwordResetController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/register', authLimiter, validateRequest(registerSchema), authController.registerRestaurant);
router.post('/login', authLimiter, validateRequest(loginSchema), authController.loginRestaurant);
router.post('/staff/login', authLimiter, validateRequest(loginSchema), authController.loginStaff);
router.post('/refresh-token', validateRequest(refreshTokenSchema), authController.refreshToken);
// OTP-BASED PASSWORD RESET (for staff)
router.post('/request-password-reset-otp', authLimiter, validateRequest(requestPasswordResetSchema), passwordResetController.requestPasswordResetOTP);
router.post('/verify-otp', authLimiter, passwordResetController.verifyPasswordResetOTP);
router.post('/set-password-with-otp', authLimiter, passwordResetController.setPasswordWithOTP);

// Protected routes
router.use(authMiddleware);
router.post('/logout', authController.logout);
router.post('/change-password', validateRequest(changePasswordSchema), authController.changePassword);
router.get('/me', authController.getCurrentUser);

export default router;
