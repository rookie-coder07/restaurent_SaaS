import logger from '../utils/logger.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import PasswordResetService from '../services/passwordResetService.js';

/**
 * OTP-BASED PASSWORD RESET FOR STAFF
 * Endpoint 1: Request OTP for password reset
 */
export const requestPasswordResetOTP = asyncHandler(async (req, res) => {
  logger.info('API HIT: POST /auth/request-password-reset-otp');
  const { email, role } = req.body;

  if (!email || !role) {
    return sendError(res, 400, 'Email and role are required');
  }

  try {
    const result = await PasswordResetService.requestPasswordResetOTP(email, role);
    return sendSuccess(res, 200, result, 'Reset link sent');
  } catch (error) {
    if (error.statusCode === 429) {
      return sendError(res, 429, error.message, {
        retryAfter: error.retryAfter || 60,
      });
    }
    throw error;
  }
});

/**
 * Endpoint 2: Verify OTP
 */
export const verifyPasswordResetOTP = asyncHandler(async (req, res) => {
  logger.info('API HIT: POST /auth/verify-otp');
  const { email, otp } = req.body;

  if (!email || !otp) {
    return sendError(res, 400, 'Email and OTP are required');
  }

  const result = await PasswordResetService.verifyPasswordResetOTP(email, otp);
  return sendSuccess(res, 200, result, 'OTP verified successfully');
});

/**
 * Endpoint 3: Set new password after OTP verification
 */
export const setPasswordWithOTP = asyncHandler(async (req, res) => {
  logger.info('API HIT: POST /auth/set-password-with-otp');
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    return sendError(res, 400, 'Email and new password are required');
  }

  // Validate password strength
  if (newPassword.length < 8) {
    return sendError(res, 400, 'Password must be at least 8 characters long');
  }

  const result = await PasswordResetService.setPasswordWithOTP(email, newPassword);
  return sendSuccess(res, 200, result, 'Password updated successfully');
});
