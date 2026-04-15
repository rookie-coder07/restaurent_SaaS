import supabase, { getSupabaseAdmin } from '../config/supabase.js';
import logger from '../utils/logger.js';
import { broadcastRestaurantEvent } from '../utils/realtimeEvents.js';
import OTPService from '../utils/otpService.js';
import EmailService from '../utils/emailService.js';
import AuthService from './authService.js';

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
      let authError;
      let authUpdateResponse;
      try {
        const adminClient = getSupabaseAdmin();
        logger.info(`🔄 Attempting to update password in Supabase Auth for user: ${userId}`);
        
        ({ data: authUpdateResponse, error: authError } = await adminClient.auth.admin.updateUserById(
          userId,
          { password: newPassword }
        ));
        
        logger.info('Supabase Auth update response:', {
          userId,
          hasError: !!authError,
          errorMsg: authError?.message || null,
          hasData: !!authUpdateResponse,
          dataUser: authUpdateResponse?.user?.id || null,
        });
      } catch (adminInitError) {
        logger.error('❌ Admin client initialization error during password reset:', {
          error: adminInitError.message,
          userId,
          stack: adminInitError.stack,
        });
        throw new Error(
          `Failed to reset password: admin client initialization failed. ` +
          `Please ensure SUPABASE_SERVICE_ROLE_KEY is set in your Render backend environment.`
        );
      }

      if (authError) {
        logger.error('❌ Supabase Auth password update failed:', {
          userId,
          email: normalizedEmail,
          errorCode: authError.code,
          errorMsg: authError.message,
          errorStatus: authError.status,
        });
        throw authError;
      }
      
      logger.info(`✅ Password successfully updated in Supabase Auth for user: ${userId}`);

      // 🔧 VERIFICATION: Test that the new password works immediately
      try {
        const testLoginResponse = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password: newPassword,
        });
        
        if (testLoginResponse.error) {
          logger.error('⚠️ Password update verification FAILED - new password does not work:', {
            userId,
            email: normalizedEmail,
            errorCode: testLoginResponse.error.code,
            errorMsg: testLoginResponse.error.message,
          });
          throw new Error(`Password update failed verification: new password does not work in Supabase Auth. ${testLoginResponse.error.message}`);
        } else if (testLoginResponse.data?.user?.id) {
          logger.info(`✅ Password verification SUCCESS - new password works for ${normalizedEmail}`);
        }
      } catch (verifyError) {
        logger.error('❌ Password verification threw an error:', {
          userId,
          email: normalizedEmail,
          error: verifyError.message,
        });
        throw verifyError;
      }

      // ✅ FIXED: Clear password_hash from database after reset
      // This ensures old passwords cannot be used
      const tableToUpdate = isRestaurant ? 'restaurants' : 'users';
      const { error: updateError } = await supabase
        .from(tableToUpdate)
        .update(AuthService.buildPasswordUpdatePayload(await AuthService.hashPassword(newPassword)))
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

  /**
   * UNIFIED PASSWORD RESET FOR ANY USER (admin/manager/staff)
   * Used when admin/manager directly resets someone's password
   * Follows same logic as OTP reset to ensure consistency
   */
  static async resetPasswordForUser(userId, userEmail, newPassword) {
    try {
      const normalizedEmail = userEmail ? userEmail.toLowerCase().trim() : '';
      
      // Validate new password has minimum requirements
      if (!newPassword || newPassword.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }

      logger.info(`🔄 Attempting unified password reset for user: ${userId}`);

      let user = null;
      let isRestaurant = false;

      // First try to find in restaurants table (for admin/owner)
      if (!user) {
        const { data: restaurant, error: restaurantError } = await supabase
          .from('restaurants')
          .select('id, email, name')
          .eq('id', userId)
          .maybeSingle();

        if (restaurant) {
          user = restaurant;
          isRestaurant = true;
          logger.info(`✅ Found user in restaurants table: ${userId}`);
        }
      }

      // Then try users table (for staff/manager/kitchen_staff)
      if (!user) {
        const { data: staffUser, error: userError } = await supabase
          .from('users')
          .select('id, restaurant_id, name, email')
          .eq('id', userId)
          .maybeSingle();

        if (staffUser) {
          user = staffUser;
          logger.info(`✅ Found user in users table: ${userId}`, {
            email: staffUser.email,
            restaurantId: staffUser.restaurant_id,
          });
        }
      }

      if (!user) {
        throw new Error('User not found');
      }

      // Update password via Supabase Auth
      let authError;
      let authUpdateResponse;
      try {
        const adminClient = getSupabaseAdmin();
        logger.info(`🔄 Updating password in Supabase Auth for user: ${userId}`);
        
        ({ data: authUpdateResponse, error: authError } = await adminClient.auth.admin.updateUserById(
          userId,
          { password: newPassword }
        ));
        
        logger.info('Supabase Auth update response:', {
          userId,
          hasError: !!authError,
          errorMsg: authError?.message || null,
          hasData: !!authUpdateResponse,
          dataUser: authUpdateResponse?.user?.id || null,
        });
      } catch (adminInitError) {
        logger.error('❌ Admin client error during password reset:', {
          error: adminInitError.message,
          userId,
          stack: adminInitError.stack,
        });
        throw adminInitError;
      }

      if (authError) {
        logger.error('❌ Supabase Auth password update failed:', {
          userId,
          email: user.email,
          errorCode: authError.code,
          errorMsg: authError.message,
          errorStatus: authError.status,
        });
        throw authError;
      }
      
      logger.info(`✅ Password successfully updated in Supabase Auth for user: ${userId}`);

      // 🔧 VERIFICATION: Test that the new password works immediately
      try {
        const testLoginResponse = await supabase.auth.signInWithPassword({
          email: user.email,
          password: newPassword,
        });
        
        if (testLoginResponse.error) {
          logger.error('⚠️ Password reset verification FAILED - new password does not work:', {
            userId,
            email: user.email,
            errorCode: testLoginResponse.error.code,
            errorMsg: testLoginResponse.error.message,
          });
          throw new Error(`Password reset failed verification: new password does not work in Supabase Auth. ${testLoginResponse.error.message}`);
        } else if (testLoginResponse.data?.user?.id) {
          logger.info(`✅ Password verification SUCCESS - new password works for ${user.email}`);
        }
      } catch (verifyError) {
        logger.error('❌ Password verification threw an error:', {
          userId,
          email: user.email,
          error: verifyError.message,
        });
        throw verifyError;
      }

      // ✅ Clear password_hash from database - Supabase Auth is now source of truth
      const tableToUpdate = isRestaurant ? 'restaurants' : 'users';
      const handledAt = new Date().toISOString();
      const { error: updateError } = await supabase
        .from(tableToUpdate)
        .update(AuthService.buildPasswordUpdatePayload(await AuthService.hashPassword(newPassword), handledAt))
        .eq('id', userId);

      if (updateError) {
        logger.error('❌ Failed to clear password_hash from database:', {
          userId,
          table: tableToUpdate,
          error: updateError.message,
        });
        throw updateError;
      }

      logger.info(`✅ Password reset completed for user: ${userId}`, {
        email: user.email,
        table: tableToUpdate,
        passwordCleared: true,
      });

      return {
        success: true,
        message: 'Password reset successfully',
        userId,
        email: user.email,
        timestamp: handledAt,
      };
    } catch (error) {
      logger.error('❌ Unified password reset error:', error.message);
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
}

export default PasswordResetService;
