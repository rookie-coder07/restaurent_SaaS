import express from 'express';
import { validateRequest } from '../middleware/validation.js';
import { authLimiter } from '../middleware/rateLimit.js';
import {
  restaurantRegisterSchema,
  staffRegisterSchema,
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

const enforcePasswordStrength = (actionLabel) => async (req, res, next) => {
  try {
    const passwordValidation = validatePasswordStrength(req.body.newPassword);
    if (!passwordValidation.valid) {
      SecurityAuditLogger.logFailedValidation(
        req.user?.id || 'unknown',
        'new_password',
        actionLabel,
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
};

const enforceRegistrationPasswordStrength = (actionLabel) => async (req, res, next) => {
  try {
    const passwordValidation = validatePasswordStrength(req.body.password);
    if (!passwordValidation.valid) {
      SecurityAuditLogger.logFailedValidation(
        'unknown',
        'password',
        actionLabel,
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
};

const changePasswordValidationStack = [
  validateRequest(changePasswordSchema),
  enforcePasswordStrength('password_change_attempt'),
  authController.changePassword,
];

router.post(
  '/register',
  authLimiter,
  validateRequest(restaurantRegisterSchema),
  enforceRegistrationPasswordStrength('registration_attempt'),
  authController.registerRestaurant
);

router.post('/login', authLimiter, validateRequest(loginSchema), async (req, res, next) => {
  try {
    const originalJson = res.json.bind(res);
    res.json = function jsonWithAudit(data) {
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
});

router.post(
  '/staff/register',
  authLimiter,
  validateRequest(staffRegisterSchema),
  enforceRegistrationPasswordStrength('staff_registration_attempt'),
  authController.registerStaff
);

router.post('/refresh-token', validateRequest(refreshTokenSchema), authController.refreshToken);
router.post(
  '/request-password-reset-otp',
  authLimiter,
  validateRequest(requestPasswordResetSchema),
  passwordResetController.requestPasswordResetOTP
);
router.post('/verify-otp', passwordResetController.verifyPasswordResetOTP);
router.post('/set-password-with-otp', passwordResetController.setPasswordWithOTP);

router.post(
  '/reset-password-for-user',
  authMiddleware,
  enforcePasswordStrength('password_reset_for_user_attempt'),
  passwordResetController.resetPasswordForUser
);

router.get('/token-info', (req, res) => {
  res.json({
    success: true,
    data: getTokenExpiryInfo(),
    message: 'Token configuration retrieved'
  });
});

router.use(authMiddleware);
router.post('/logout', authController.logout);
router.post('/change-password', ...changePasswordValidationStack);
router.put('/change-password', ...changePasswordValidationStack);
router.patch('/change-password', ...changePasswordValidationStack);
router.post('/password/change', ...changePasswordValidationStack);
router.put('/password/change', ...changePasswordValidationStack);
router.patch('/password/change', ...changePasswordValidationStack);
router.get('/me', authController.getCurrentUser);

export default router;
