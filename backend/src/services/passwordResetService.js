import supabase from '../config/supabase.js';
import logger from '../utils/logger.js';
import { broadcastRestaurantEvent } from '../utils/realtimeEvents.js';
import OTPService from '../utils/otpService.js';
import EmailService from '../utils/emailService.js';

class PasswordResetService {

  /**
   * NEW OTP-BASED PASSWORD RESET FOR STAFF AND OWNERS
   * Step 1: Request password reset with OTP
   */
  static async requestPasswordResetOTP(email, role) {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      let user = null;
      let restaurantId = null;
      let userName = 'User';

      // First check if it's a restaurant owner (admin portal)
      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .select('id, name, email')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (restaurant && !restaurantError) {
        user = {
          id: restaurant.id,
          restaurant_id: restaurant.id,
          name: restaurant.name,
        };
        restaurantId = restaurant.id;
        userName = restaurant.name;
      } else {
        // Check if it's a staff/user account
        const { data: staffUser, error: userError } = await supabase
          .from('users')
          .select('id, restaurant_id, name')
          .eq('email', normalizedEmail)
          .maybeSingle();

        if (userError && userError.code !== 'PGRST116') {
          throw userError;
        }

        if (staffUser) {
          user = staffUser;
          restaurantId = staffUser.restaurant_id;
          userName = staffUser.name;
        }
      }

      if (!user) {
        throw new Error('User not found with this email');
      }

      // Generate OTP with request-only cooldown
      const otpResult = await OTPService.createOTP(normalizedEmail);
      if (!otpResult.success) {
        const cooldownError = new Error(otpResult.error || 'Please wait before requesting another reset.');
        cooldownError.statusCode = 429;
        cooldownError.retryAfter = otpResult.retryAfter || 60;
        throw cooldownError;
      }

      const { otp } = otpResult;

      // Send OTP email
      const emailResult = await EmailService.sendOTPEmail(
        normalizedEmail,
        otp,
        userName || 'User'
      );

      if (!emailResult.success) {
        logger.warn(`⚠️ Email sending failed but OTP is available: ${otp}`);
        // In development, continue anyway so OTP is logged
      }

      logger.info(`✅ OTP password reset request created for ${normalizedEmail}`);

      // Broadcast notification
      if (restaurantId) {
        broadcastRestaurantEvent(restaurantId, 'notification', {
          type: 'password_reset.otp_requested',
          userEmail: normalizedEmail,
          userRole: role,
          message: `OTP sent for password reset`,
          priority: 'low',
        });
      }

      logger.info(`✅ OTP sent successfully to ${normalizedEmail}`);
      return { 
        success: true, 
        message: 'OTP sent to your email',
        messageId: emailResult.messageId 
      };
    } catch (error) {
      logger.error('❌ Request password reset OTP error:', error.message);
      // Return user-friendly error messages
      const errorMsg = error.message || 'Failed to send OTP';
      if (errorMsg.includes('not found')) {
        throw new Error('Email not found in the system');
      }
      throw error;
    }
  }

  /**
   * Step 2: Verify OTP
   */
  static async verifyPasswordResetOTP(email, otp) {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      const result = await OTPService.verifyOTP(normalizedEmail, otp);

      if (!result.success) {
        throw new Error(result.error || 'Invalid OTP');
      }

      logger.info(`✅ OTP verified for ${normalizedEmail}`);
      return { success: true, message: 'OTP verified' };
    } catch (error) {
      logger.error('❌ Verify OTP error:', error.message);
      const errorMsg = error.message || 'Invalid OTP';
      if (errorMsg.includes('not found')) {
        throw new Error('OTP not found. Please request a new one.');
      }
      if (errorMsg.includes('expired')) {
        throw new Error('OTP expired. Please request a new one.');
      }
      throw error;
    }
  }

  /**
   * Step 3: Set new password after OTP verification
   */
  static async setPasswordWithOTP(email, newPassword) {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      
      // Validate new password has minimum requirements
      if (!newPassword || newPassword.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }

      const verifiedReset = await OTPService.requireVerifiedReset(normalizedEmail);
      if (!verifiedReset.success) {
        throw new Error(verifiedReset.error || 'Reset session not verified');
      }

      let user = null;
      let isRestaurant = false;
      let userId = null;

      // Check if it's a restaurant owner
      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .select('id, email')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (restaurant && !restaurantError) {
        user = restaurant;
        isRestaurant = true;
        userId = restaurant.id;
      } else {
        // Check if it's a staff/user account
        const { data: staffUser, error: userError } = await supabase
          .from('users')
          .select('id, restaurant_id, email')
          .eq('email', normalizedEmail)
          .maybeSingle();

        if (userError && userError.code !== 'PGRST116') {
          throw userError;
        }

        if (staffUser) {
          user = staffUser;
          userId = staffUser.id;
        }
      }

      if (!user) {
        throw new Error('User not found');
      }

      // Update password via Supabase Auth
      const { error: authError } = await supabase.auth.admin.updateUserById(
        userId,
        { password: newPassword }
      );

      if (authError) throw authError;

      // Update user record with timestamp
      const tableToUpdate = isRestaurant ? 'restaurants' : 'users';
      const { error: updateError } = await supabase
        .from(tableToUpdate)
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateError) throw updateError;

      // Clear verified reset state after successful password update
      await OTPService.invalidateOTP(normalizedEmail);

      logger.info(`✅ Password reset completed for ${normalizedEmail} via OTP`);

      // Send confirmation email
      const userName = isRestaurant ? (user.name || 'Restaurant Owner') : (user.name || 'User');
      await EmailService.sendPasswordResetSuccessEmail(normalizedEmail, userName);

      // Broadcast notification to restaurant
      const broadcastRestId = isRestaurant ? userId : (user.restaurant_id || restaurantId);
      if (broadcastRestId) {
        broadcastRestaurantEvent(broadcastRestId, 'notification', {
          type: 'password_reset.otp_completed',
          userEmail: normalizedEmail,
          message: 'Password reset successfully',
          priority: 'medium',
        });
      }

      return { success: true, message: 'Password reset successfully' };
    } catch (error) {
      logger.error('❌ Set password with OTP error:', error.message);
      const errorMsg = error.message || 'Password reset failed';
      if (errorMsg.includes('not found')) {
        throw new Error('User not found');
      }
      if (errorMsg.includes('password')) {
        throw new Error('Password must be at least 8 characters');
      }
      throw error;
    }
  }

  /**
   * Get OTP status (for debugging/testing)
   */
  static async getOTPStatus(email) {
    try {
      return await OTPService.getOTPStatus(email);
    } catch (error) {
      logger.error('❌ Get OTP status error:', error.message);
      throw error;
    }
  }
}

export default PasswordResetService;
