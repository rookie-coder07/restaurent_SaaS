import logger from '../utils/logger.js';
import { sendError } from '../utils/apiResponse.js';

export const errorHandler = (err, req, res, next) => {
  // Log error
  logger.error('Unhandled Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    user: req.user?.email,
    restaurantId: req.restaurantId,
  });

  // Handle Joi validation errors
  if (err.isJoi) {
    const message = err.details.map(d => d.message).join(', ');
    return sendError(res, 400, 'Validation error', {
      details: err.details,
    });
  }

  // Handle MongoDB validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors)
      .map(e => e.message);
    return sendError(res, 400, 'Validation error', {
      details: messages,
    });
  }

  // Handle MongoDB duplicate key errors
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return sendError(res, 409, `${field} already exists`);
  }

  // Handle Postgres/Supabase invalid type errors from stale schemas
  if (
    err?.code === '22P02' &&
    String(err?.message || '').includes('invalid input syntax for type integer') &&
    String(err?.message || '').includes('A1')
  ) {
    return sendError(
      res,
      400,
      'Your tables schema is still numeric-only. Apply the table label migration to allow values like A1 or C9.'
    );
  }

  if (
    err?.code === '22P02' &&
    String(err?.message || '').includes('invalid input syntax for type integer') &&
    String(err?.message || '').includes('table_number')
  ) {
    return sendError(
      res,
      400,
      'Your tables schema is still numeric-only. Apply the table label migration to allow alphanumeric table labels.'
    );
  }

  if (
    String(err?.message || '').includes('users.assigned_tables') ||
    String(err?.message || '').includes("Could not find the 'assigned_tables' column of 'users' in the schema cache")
  ) {
    return sendError(
      res,
      500,
      'Your database is missing users.assigned_tables. Apply the staff table-assignment migration and restart the backend.'
    );
  }

  if (
    String(err?.message || '').includes("Could not find the 'menu_item_recipes'") ||
    String(err?.message || '').includes('menu_item_recipes') ||
    String(err?.message || '').includes('inventory_items!inventory_item_id')
  ) {
    return sendError(
      res,
      500,
      'Your database is missing the menu recipe tables/relations needed by menu management. Apply the inventory/menu recipe migrations and restart the backend.'
    );
  }

  if (
    String(err?.message || '').includes('password_reset_requests') ||
    String(err?.message || '').includes("Could not find the 'password_reset_requests'")
  ) {
    return sendError(
      res,
      500,
      'Your database is missing password_reset_requests. Apply the password reset request migration and restart the backend.'
    );
  }

  const businessMessage = String(err?.message || '');
  const isBusinessRuleError =
    businessMessage.includes('Cash received must be at least the bill total') ||
    businessMessage.includes('Cash received amount is required for cash settlement') ||
    businessMessage.includes('Unsupported payment method') ||
    businessMessage.includes('Order is already settled') ||
    businessMessage.includes('Cancelled orders cannot be settled') ||
    businessMessage.includes('Order total must be greater than zero before settlement') ||
    businessMessage.includes('Add at least one item before sending to kitchen') ||
    businessMessage.includes('No new kitchen changes to send for this bill') ||
    businessMessage.includes('Not enough stock for') ||
    businessMessage.includes('No matching account found for this reset request') ||
    businessMessage.includes('More than one matching account was found') ||
    businessMessage.includes('A password reset request is already pending for this account') ||
    businessMessage.includes('Only manager or admin can view reset requests') ||
    businessMessage.includes('Only manager or admin can reset passwords from requests') ||
    businessMessage.includes('This reset request has already been handled') ||
    businessMessage.includes('You are not allowed to process this reset request') ||
    businessMessage.includes('Requested user account not found') ||
    businessMessage.includes('Reset request role does not match the target account') ||
    businessMessage.includes('You cannot reset your own password through reset requests') ||
    businessMessage.includes('Password reset requests are available only for manager and POS accounts') ||
    businessMessage.includes('Only ') && businessMessage.includes('loyalty points are available');

  if (isBusinessRuleError) {
    return sendError(res, 400, businessMessage);
  }

  // Handle custom AppError
  if (err.statusCode) {
    return sendError(res, err.statusCode, err.message);
  }

  // Default error response
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  return sendError(res, statusCode, message);
};

// Catch 404 errors
export const notFoundHandler = (req, res, next) => {
  logger.warn(`404 Not Found: ${req.method} ${req.path}`);
  return sendError(res, 404, `Route not found: ${req.method} ${req.path}`);
};

// Async error wrapper
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
