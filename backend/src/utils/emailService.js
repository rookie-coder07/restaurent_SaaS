import logger from './logger.js';

/**
 * Email Service - Sends emails via Resend API
 * Using serverless email service instead of SMTP for better reliability
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY || 'test-key';
const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM_EMAIL = 'noreply@restaurant-saas.com';

class EmailService {
  /**
   * Send OTP email to user
   */
  static async sendOTPEmail(email, otp, userName = 'User') {
    try {
      logger.info(`📧 Sending OTP email to ${email}`);

      // For development, just log the OTP
      if (process.env.NODE_ENV === 'development' || !RESEND_API_KEY || RESEND_API_KEY === 'test-key') {
        logger.info(`🔐 OTP for ${email}: ${otp} (Valid for 10 minutes)`);
        return { success: true, messageId: 'dev-mode', email };
      }

      const emailBody = `
        <h2>Password Reset Request</h2>
        <p>Hello ${userName},</p>
        <p>You requested a password reset. Your One-Time Password (OTP) is:</p>
        <h1 style="color: #007bff; font-family: monospace; letter-spacing: 2px;">${otp}</h1>
        <p style="color: #666;">This OTP is valid for 10 minutes only.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <hr/>
        <p style="font-size: 12px; color: #999;">This is an automated message. Please do not reply.</p>
      `;

      const response = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: email,
          subject: 'Password Reset - Your OTP Code',
          html: emailBody,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send email');
      }

      const result = await response.json();
      logger.info(`✅ Email sent successfully to ${email}`);
      return { success: true, messageId: result.id, email };
    } catch (error) {
      logger.error(`❌ Failed to send OTP email to ${email}:`, error.message);
      // Don't throw - allow password reset to continue with OTP in logs for dev mode
      return { success: false, error: error.message, email };
    }
  }

  /**
   * Send password reset success email
   */
  static async sendPasswordResetSuccessEmail(email, userName = 'User') {
    try {
      logger.info(`📧 Sending password reset success email to ${email}`);

      if (process.env.NODE_ENV === 'development' || !RESEND_API_KEY || RESEND_API_KEY === 'test-key') {
        logger.info(`✅ Password reset confirmation sent to ${email} (dev mode)`);
        return { success: true, messageId: 'dev-mode', email };
      }

      const emailBody = `
        <h2>Password Reset Successful</h2>
        <p>Hello ${userName},</p>
        <p>Your password has been successfully reset.</p>
        <p>You can now log in with your new password.</p>
        <p style="color: #666; margin-top: 20px;">If you didn't request this change, please contact support immediately.</p>
        <hr/>
        <p style="font-size: 12px; color: #999;">This is an automated message. Please do not reply.</p>
      `;

      const response = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: email,
          subject: 'Password Reset Successful',
          html: emailBody,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send email');
      }

      const result = await response.json();
      logger.info(`✅ Confirmation email sent to ${email}`);
      return { success: true, messageId: result.id, email };
    } catch (error) {
      logger.error(`❌ Failed to send confirmation email:`, error.message);
      return { success: false, error: error.message, email };
    }
  }
}

export default EmailService;
