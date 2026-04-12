import logger from '../utils/logger.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import AuthService from '../services/authService.js';
import { ActivityService } from '../services/activityService.js';
import { logError, logFailedRequest, logCriticalAction } from '../utils/structuredLogging.js';
import { TOKEN_CONFIG, rotateRefreshToken } from '../utils/tokenManager.js';
import supabase from '../config/supabase.js';

export const registerRestaurant = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    phone,
    password,
    city,
    address,
    gstNumber,
    restaurant_name,
    restaurantName,
  } = req.body;

  const finalRestaurantName = name || restaurant_name || restaurantName;

  if (!finalRestaurantName || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Invalid request data',
      received: req.body,
    });
  }

  const result = await AuthService.registerRestaurant({
    name: finalRestaurantName,
    email,
    phone,
    password,
    city,
    address,
    gstNumber,
  });

  res.cookie('accessToken', result.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: TOKEN_CONFIG.ACCESS_TOKEN_SECONDS * 1000, // 1 hour
  });

  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: TOKEN_CONFIG.REFRESH_TOKEN_SECONDS * 1000, // 7 days
  });

  return sendSuccess(res, 201, result, 'Restaurant registered successfully');
});

export const registerStaff = asyncHandler(async (req, res) => {
  const { name, email, password, confirmPassword, phone, restaurantId, role } = req.body;

  if (password !== confirmPassword) {
    return sendError(res, 400, 'Passwords do not match');
  }

  const result = await AuthService.registerStaff({
    name,
    email,
    password,
    phone,
    restaurantId,
    role,
  });

  res.cookie('accessToken', result.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: TOKEN_CONFIG.ACCESS_TOKEN_SECONDS * 1000,
  });

  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: TOKEN_CONFIG.REFRESH_TOKEN_SECONDS * 1000,
  });

  return sendSuccess(res, 201, result, 'Staff registered successfully');
});

export const login = asyncHandler(async (req, res) => {
  const { email, password, portal = 'admin' } = req.body;

  try {
    if (!email || !password) {
      logFailedRequest(new Error('Missing credentials'), {
        message: 'Login validation failed',
        endpoint: req.path,
        method: req.method,
        statusCode: 400,
        action: 'login_validation',
      });
      return sendError(res, 400, 'Email and password are required');
    }

    const normalizedPortal = String(portal || 'admin').trim().toLowerCase();
    const { data: globalMaintenance, error: maintenanceError } = await supabase
      .from('system_settings')
      .select('setting_value')
      .is('restaurant_id', null)
      .eq('setting_key', 'global_maintenance')
      .maybeSingle();

    if (maintenanceError && maintenanceError.code !== 'PGRST116' && maintenanceError.code !== 'PGRST205') {
      throw maintenanceError;
    }

    const maintenanceValue =
      typeof globalMaintenance?.setting_value === 'object' && globalMaintenance?.setting_value
        ? globalMaintenance.setting_value
        : {};

    if (maintenanceValue.enabled && normalizedPortal !== 'developer') {
      return sendError(res, 503, maintenanceValue.message || 'System is currently under maintenance.');
    }

    const result = await AuthService.login(email, password, portal);
    const userRole = result.role;
    const redirectTo = result.redirectTo;
    const userIdForActivity = result.userId;

    console.log('[AUTH_CONTROLLER] Login result:', {
      userId: result.userId,
      email,
      role: userRole,
      portal,
      redirectTo,
    });

    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: TOKEN_CONFIG.ACCESS_TOKEN_SECONDS * 1000,
    });

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: TOKEN_CONFIG.REFRESH_TOKEN_SECONDS * 1000,
    });

    logger.info('Login success response', {
      userId: result.userId,
      role: userRole,
      restaurantId: result.restaurantId,
      portal,
    });

    // Log activity
    setImmediate(() => {
      ActivityService.logActivity(
        result.restaurantId,
        result.userId,
        'user_login',
        {
          email,
          role: userRole,
          portal,
          loginTime: new Date().toISOString(),
        }
      ).catch(err => logger.error('Failed to log login activity:', err));
    });

    return sendSuccess(res, 200, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: {
        id: result.userId,
        email,
        role: userRole,
        restaurantId: result.restaurantId,
        redirectTo,
      },
      token: result.accessToken,
      role: userRole,
      restaurant_id: result.restaurantId,
      redirectTo,
    }, 'Login successful');
  } catch (error) {
    const statusCode = error.message === 'Invalid email or password' ? 401 : 500;
    logError(error, {
      message: 'Login failed',
      endpoint: req.path,
      method: req.method,
      statusCode,
      action: 'login',
    });
    return sendError(res, statusCode, error.message || 'Login failed');
  }
});

export const refreshToken = asyncHandler(async (req, res) => {
  // Prefer the refresh token sent by the active SPA portal session.
  // Falling back to cookies is still allowed for same-origin flows, but
  // cookies should not override the portal-specific token from local storage.
  const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;

  if (!refreshToken) {
    logger.warn('Refresh token missing', { path: req.path });
    return sendError(res, 401, 'Refresh token is required');
  }

  try {
    const result = await AuthService.refreshAccessToken(refreshToken);

    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: TOKEN_CONFIG.ACCESS_TOKEN_SECONDS * 1000, // 1 hour
    });

    // Issue rotated refresh token to the client when available
    if (result.refreshToken) {
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: TOKEN_CONFIG.REFRESH_TOKEN_SECONDS * 1000,
      });
    }

    return sendSuccess(
      res,
      200,
      {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken || refreshToken,
        expiresIn: TOKEN_CONFIG.ACCESS_TOKEN_SECONDS,
        refreshExpiresIn: result.refreshExpiresIn || TOKEN_CONFIG.REFRESH_TOKEN_SECONDS,
      },
      'Token refreshed'
    );
  } catch (error) {
    logger.error('Token refresh failed:', {
      error: error.message,
      errorName: error.name,
      path: req.path,
    });

    // Return specific error for expired/invalid tokens
    if (error.message && error.message.includes('expired')) {
      return sendError(res, 401, 'Session expired. Please log in again');
    }

    if (error.message && error.message.includes('invalid')) {
      return sendError(res, 401, 'Invalid token. Please log in again');
    }

    return sendError(res, 401, 'Failed to refresh token. Please log in again');
  }
});

export const logout = asyncHandler(async (req, res) => {
  try {
    // Get refresh token from body or cookies
    const refreshToken = req.body?.refreshToken || req.cookies?.refreshToken;
    
    // Revoke refresh token if present
    if (refreshToken) {
      const { revokeRefreshToken } = await import('../utils/tokenManager.js');
      await revokeRefreshToken(refreshToken);
    }

    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    logger.info('User logged out', { userId: req.user?.userId });
    return sendSuccess(res, 200, null, 'Logged out successfully');
  } catch (error) {
    // Even if token revocation fails, still clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    logger.warn('Logout completed with warning', { error: error.message });
    return sendSuccess(res, 200, null, 'Logged out successfully');
  }
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const isRestaurant = ['admin'].includes(req.user.role);

  await AuthService.changePassword(
    req.user.userId,
    currentPassword,
    newPassword,
    isRestaurant
  );

  return sendSuccess(res, 200, null, 'Password changed successfully');
});

export const requestPasswordReset = asyncHandler(async (req, res) => {
  const { email, role } = req.body;

  const result = await AuthService.requestPasswordReset({
    email,
    requestedRole: role,
  });

});

export const resetUserPassword = asyncHandler(async (req, res) => {
  const { requestId, newPassword } = req.body;

  const result = await AuthService.resetUserPasswordFromRequest({
    restaurantId: req.user.restaurantId,
    actor: req.user,
    requestId,
    newPassword,
  });

  return sendSuccess(res, 200, result, 'Password reset completed');
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  logger.info(`API HIT: GET /auth/me - User: ${req.user.id}`);
  const currentUser = await AuthService.getCurrentUserProfile(req.user);

  return sendSuccess(res, 200, {
    user: currentUser,
  }, 'User details fetched');
});
