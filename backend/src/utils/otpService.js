import logger from './logger.js';

/**
 * OTP (One-Time Password) Service
 * Generates, stores, and validates OTPs for password reset
 */

// In-memory store for OTPs (use Redis/cache in production)
const otpStore = new Map();

// OTP Configuration
const OTP_LENGTH = 6;
const OTP_LIFETIME_MINUTES = 10; // OTP valid for 10 minutes
const MAX_ATTEMPTS = 5; // Max verification attempts
const ATTEMPT_RESET_MINUTES = 15; // Reset attempts after 15 minutes

class OTPService {
  /**
   * Generate a random 6-digit OTP
   */
  static generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Create and store OTP for email
   * Returns the OTP (in dev mode) and stores it
   */
  static async createOTP(email) {
    try {
      const otp = this.generateOTP();
      const expiresAt = Date.now() + OTP_LIFETIME_MINUTES * 60 * 1000;

      // Store OTP
      otpStore.set(email, {
        otp,
        expiresAt,
        attempts: 0,
        createdAt: Date.now(),
      });

      logger.info(`🔐 OTP created for ${email}: ${otp} (Expires in ${OTP_LIFETIME_MINUTES} minutes)`);
      return { success: true, otp, expiresAt };
    } catch (error) {
      logger.error(`❌ Failed to create OTP:`, error.message);
      throw error;
    }
  }

  /**
   * Verify OTP for email
   */
  static async verifyOTP(email, providedOtp) {
    try {
      const record = otpStore.get(email);

      if (!record) {
        logger.warn(`⚠️ OTP verification failed: No OTP found for ${email}`);
        return { success: false, error: 'No OTP found. Please request a new password reset.' };
      }

      // Check if OTP expired
      if (Date.now() > record.expiresAt) {
        otpStore.delete(email);
        logger.warn(`⚠️ OTP expired for ${email}`);
        return { success: false, error: 'OTP has expired. Please request a new password reset.' };
      }

      // Check if max attempts exceeded
      if (record.attempts >= MAX_ATTEMPTS) {
        // Check if reset period has passed
        const minutesSinceCreated = (Date.now() - record.createdAt) / (60 * 1000);
        if (minutesSinceCreated < ATTEMPT_RESET_MINUTES) {
          logger.warn(`⚠️ Max OTP attempts exceeded for ${email}`);
          return { 
            success: false, 
            error: `Too many attempts. Please try again after ${ATTEMPT_RESET_MINUTES} minutes.` 
          };
        } else {
          // Reset attempts
          record.attempts = 0;
        }
      }

      // Verify OTP
      if (record.otp !== providedOtp.toString()) {
        record.attempts++;
        logger.warn(`⚠️ Invalid OTP for ${email} (Attempt ${record.attempts}/${MAX_ATTEMPTS})`);
        return { 
          success: false, 
          error: `Invalid OTP. ${MAX_ATTEMPTS - record.attempts} attempt(s) remaining.` 
        };
      }

      // OTP verified successfully
      otpStore.delete(email);
      logger.info(`✅ OTP verified successfully for ${email}`);
      return { success: true };
    } catch (error) {
      logger.error(`❌ OTP verification error:`, error.message);
      throw error;
    }
  }

  /**
   * Invalidate OTP for email (after successful password reset)
   */
  static async invalidateOTP(email) {
    try {
      otpStore.delete(email);
      logger.info(`🗑️ OTP invalidated for ${email}`);
      return { success: true };
    } catch (error) {
      logger.error(`❌ Failed to invalidate OTP:`, error.message);
      throw error;
    }
  }

  /**
   * Get OTP details (for debugging/testing)
   */
  static async getOTPStatus(email) {
    const record = otpStore.get(email);
    
    if (!record) {
      return { exists: false, email };
    }

    const expiresIn = Math.max(0, Math.round((record.expiresAt - Date.now()) / 1000));
    return {
      exists: true,
      email,
      attempts: record.attempts,
      expiresIn: `${expiresIn}s`,
      expired: Date.now() > record.expiresAt,
    };
  }

  /**
   * Clear all OTPs (for testing)
   */
  static async clearAllOTPs() {
    const count = otpStore.size;
    otpStore.clear();
    logger.info(`🗑️ Cleared ${count} OTPs`);
    return { success: true, cleared: count };
  }
}

export default OTPService;
