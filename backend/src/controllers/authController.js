import logger from '../utils/logger.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import AuthService from '../services/authService.js';

export const registerRestaurant = asyncHandler(async (req, res) => {
  const { name, email, phone, password, city, address, gstNumber } = req.body;

  const result = await AuthService.registerRestaurant({
    name,
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
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return sendSuccess(res, 201, result, 'Restaurant registered successfully');
});

export const loginRestaurant = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const result = await AuthService.loginRestaurant(email, password);

  res.cookie('accessToken', result.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000,
  });

  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return sendSuccess(res, 200, result, 'Login successful');
});

export const loginStaff = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const result = await AuthService.loginStaff(email, password);

  res.cookie('accessToken', result.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000,
  });

  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return sendSuccess(res, 200, result, 'Staff login successful');
});

export const refreshToken = asyncHandler(async (req, res) => {
  // Prefer the refresh token sent by the active SPA portal session.
  // Falling back to cookies is still allowed for same-origin flows, but
  // cookies should not override the portal-specific token from local storage.
  const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;

  if (!refreshToken) {
    return sendError(res, 401, 'Refresh token is required');
  }

  const result = await AuthService.refreshAccessToken(refreshToken);

  res.cookie('accessToken', result.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000,
  });

  return sendSuccess(res, 200, { accessToken: result.accessToken }, 'Token refreshed');
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');

  return sendSuccess(res, 200, null, 'Logged out successfully');
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const isRestaurant = req.user.role === 'owner';

  await AuthService.changePassword(
    req.user.userId,
    currentPassword,
    newPassword,
    isRestaurant
  );

  return sendSuccess(res, 200, null, 'Password changed successfully');
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  return sendSuccess(res, 200, {
    user: req.user,
  }, 'User details fetched');
});
