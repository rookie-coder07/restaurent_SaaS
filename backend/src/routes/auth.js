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
import SecurityAuditLogger from '../utils/securityAudit.js';
import { validatePasswordStrength } from '../utils/passwordSecurity.js';
import { getTokenExpiryInfo } from '../utils/tokenManager.js';

const router = express.Router();

// Public routes
router.post('/register', authLimiter, validateRequest(registerSchema), async (req, res, next) => {
  try {
    // ✅ Validate password strength
    const passwordValidation = validatePasswordStrength(req.body.password);
    if (!passwordValidation.valid) {
      SecurityAuditLogger.logFailedValidation(
        'unknown',
        'password',
        'registration_attempt',
        passwordValidation.errors.join('; '),
        req.ip
      );
      return res.status(400).json({
        success: false,
        errors: passwordValidation.errors,
        message: 'Password does not meet security requirements'
      });
    }
    next();
  } catch (error) {
    next(error);
  }
}, authController.registerRestaurant);

// Unified login for both restaurant owners and staff
router.post('/login', authLimiter, validateRequest(loginSchema), async (req, res, next) => {
  try {
    const originalJson = res.json.bind(res);
    res.json = function(data) {
      if (data.success) {
        SecurityAuditLogger.logLoginAttempt(req.body.email, true, req.ip);
      } else {
        SecurityAuditLogger.logLoginAttempt(req.body.email, false, req.ip, data.message || 'Invalid credentials');
      }
      return originalJson(data);
    };
    next();
  } catch (error) {
    SecurityAuditLogger.logLoginAttempt(req.body.email, false, req.ip, error.message);
    next(error);
  }
}, authController.login);

router.post('/staff/register', authLimiter, validateRequest(registerSchema), async (req, res, next) => {
  try {
    // ✅ Validate password strength
    const passwordValidation = validatePasswordStrength(req.body.password);
    if (!passwordValidation.valid) {
      SecurityAuditLogger.logFailedValidation(
        'unknown',
        'password',
        'staff_registration_attempt',
        passwordValidation.errors.join('; '),
        req.ip
      );
      return res.status(400).json({
        success: false,
        errors: passwordValidation.errors,
        message: 'Password does not meet security requirements'
      });
    }
    next();
  } catch (error) {
    next(error);
  }
}, authController.registerStaff);

router.post('/refresh-token', validateRequest(refreshTokenSchema), authController.refreshToken);
// OTP-BASED PASSWORD RESET (for staff)
router.post('/request-password-reset-otp', authLimiter, validateRequest(requestPasswordResetSchema), passwordResetController.requestPasswordResetOTP);
router.post('/verify-otp', authLimiter, passwordResetController.verifyPasswordResetOTP);
router.post('/set-password-with-otp', authLimiter, passwordResetController.setPasswordWithOTP);

// Token expiry information endpoint (PUBLIC - used by frontend to determine refresh timing)
router.get('/token-info', (req, res) => {
  res.json({
    success: true,
    data: getTokenExpiryInfo(),
    message: 'Token configuration retrieved'
  });
});

// Protected routes - everything after this requires auth
router.use(authMiddleware);
router.post('/logout', authController.logout);
router.post('/change-password', validateRequest(changePasswordSchema), async (req, res, next) => {
  try {
    // ✅ Validate new password strength
    const passwordValidation = validatePasswordStrength(req.body.newPassword);
    if (!passwordValidation.valid) {
      SecurityAuditLogger.logFailedValidation(
        req.user.id,
        'new_password',
        'password_change_attempt',
        passwordValidation.errors.join('; '),
        req.ip
      );
      return res.status(400).json({
        success: false,
        errors: passwordValidation.errors,
        message: 'New password does not meet security requirements'
      });
    }
    next();
  } catch (error) {
    next(error);
  }
}, authController.changePassword);
router.get('/me', authController.getCurrentUser);

export default router;
