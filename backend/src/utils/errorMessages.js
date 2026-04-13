/**
 * Error Messages Utility
 * Centralized error messages for consistent user-friendly error handling
 */

export const ERROR_CODES = {
  // Authentication
  INVALID_LOGIN: 'invalid_login',
  ACCOUNT_NOT_FOUND: 'account_not_found',
  PASSWORD_MISMATCH: 'password_mismatch',
  WEAK_PASSWORD: 'weak_password',
  EMAIL_TAKEN: 'email_taken',
  SESSION_EXPIRED: 'session_expired',
  INVALID_TOKEN: 'invalid_token',
  
  // Validation
  MISSING_FIELD: 'missing_field',
  INVALID_EMAIL: 'invalid_email',
  INVALID_PHONE: 'invalid_phone',
  INVALID_PRICE: 'invalid_price',
  INVALID_QUANTITY: 'invalid_quantity',
  
  // Permissions
  INSUFFICIENT_PERMISSIONS: 'insufficient_permissions',
  ADMIN_ONLY: 'admin_only',
  OWNER_ONLY: 'owner_only',
  
  // Resource operations
  NOT_FOUND: 'not_found',
  ALREADY_EXISTS: 'already_exists',
  CANNOT_DELETE: 'cannot_delete',
  CANNOT_UPDATE: 'cannot_update',
  
  // Network
  NETWORK_ERROR: 'network_error',
  TIMEOUT: 'timeout',
  SERVER_ERROR: 'server_error',
  
  // Rate limiting
  RATE_LIMIT: 'rate_limit',
  RATE_LIMIT_AUTH: 'rate_limit_auth',
  
  // Upload
  FILE_TOO_LARGE: 'file_too_large',
  INVALID_FILE_TYPE: 'invalid_file_type',
  FILE_REQUIRED: 'file_required',
};

export const ERROR_MESSAGES = {
  // Authentication
  [ERROR_CODES.INVALID_LOGIN]: 'Incorrect email or password',
  [ERROR_CODES.ACCOUNT_NOT_FOUND]: 'No account found with this email',
  [ERROR_CODES.PASSWORD_MISMATCH]: 'The passwords do not match',
  [ERROR_CODES.WEAK_PASSWORD]: 'Password must be at least 8 characters',
  [ERROR_CODES.EMAIL_TAKEN]: 'This email is already registered',
  [ERROR_CODES.SESSION_EXPIRED]: 'Your session has expired. Please log in again',
  [ERROR_CODES.INVALID_TOKEN]: 'Invalid or expired authentication token',
  
  // Validation
  [ERROR_CODES.MISSING_FIELD]: 'Please fill in all required fields',
  [ERROR_CODES.INVALID_EMAIL]: 'Please enter a valid email address',
  [ERROR_CODES.INVALID_PHONE]: 'Please enter a valid phone number',
  [ERROR_CODES.INVALID_PRICE]: 'Price must be a valid number',
  [ERROR_CODES.INVALID_QUANTITY]: 'Quantity must be a positive number',
  
  // Permissions
  [ERROR_CODES.INSUFFICIENT_PERMISSIONS]: 'You do not have permission to perform this action',
  [ERROR_CODES.ADMIN_ONLY]: 'Only administrators can perform this action',
  [ERROR_CODES.OWNER_ONLY]: 'Only restaurant owners can perform this action',
  
  // Resource operations
  [ERROR_CODES.NOT_FOUND]: 'The item you are looking for does not exist',
  [ERROR_CODES.ALREADY_EXISTS]: 'This item already exists',
  [ERROR_CODES.CANNOT_DELETE]: 'This item cannot be deleted because it is in use',
  [ERROR_CODES.CANNOT_UPDATE]: 'This item cannot be updated',
  
  // Network
  [ERROR_CODES.NETWORK_ERROR]: 'Check your internet connection and try again',
  [ERROR_CODES.TIMEOUT]: 'The request took too long. Please try again',
  [ERROR_CODES.SERVER_ERROR]: 'Server error. Our team has been notified. Please try again later',
  
  // Rate limiting
  [ERROR_CODES.RATE_LIMIT]: 'Too many requests. Please wait a moment before trying again',
  [ERROR_CODES.RATE_LIMIT_AUTH]: 'Too many login attempts. Please wait before trying again',
  
  // Upload
  [ERROR_CODES.FILE_TOO_LARGE]: 'File is too large. Maximum size is 5MB',
  [ERROR_CODES.INVALID_FILE_TYPE]: 'File type is not supported',
  [ERROR_CODES.FILE_REQUIRED]: 'Please select a file to upload',
};

export const getErrorMessage = (errorCode = ERROR_CODES.SERVER_ERROR) => {
  return ERROR_MESSAGES[errorCode] || 'Something went wrong. Please try again.';
};

/**
 * Create a user-friendly error response
 * @param {number} statusCode - HTTP status code
 * @param {string} errorCode - Error code from ERROR_CODES
 * @param {string} overrideMessage - Optional custom message
 * @returns {Object} Error response object
 */
export const createErrorResponse = (statusCode = 500, errorCode = ERROR_CODES.SERVER_ERROR, overrideMessage = null) => {
  return {
    success: false,
    statusCode,
    code: errorCode,
    message: overrideMessage || getErrorMessage(errorCode),
  };
};

/**
 * Map database errors to user-friendly messages
 * @param {Error} error - Database or API error
 * @returns {Object} Error code and status code
 */
export const mapDatabaseError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  
  if (error?.code === '23505' || error?.code === 'unique_violation' || message.includes('unique')) {
    return { code: ERROR_CODES.ALREADY_EXISTS, status: 409 };
  }
  
  if (error?.code === '23503' || error?.code === 'foreign_key_violation') {
    return { code: ERROR_CODES.NOT_FOUND, status: 404 };
  }
  
  if (error?.code === '23502' || error?.code === 'not_null_violation') {
    return { code: ERROR_CODES.MISSING_FIELD, status: 400 };
  }
  
  if (message.includes('not found') || message.includes('does not exist')) {
    return { code: ERROR_CODES.NOT_FOUND, status: 404 };
  }
  
  if (message.includes('validation')) {
    return { code: ERROR_CODES.MISSING_FIELD, status: 400 };
  }
  
  return { code: ERROR_CODES.SERVER_ERROR, status: 500 };
};
