/**
 * Frontend Error Types and Handlers
 * Comprehensive error classification and user-friendly messages
 */

export const ERROR_TYPES = {
  NETWORK: 'network',
  VALIDATION: 'validation',
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  NOT_FOUND: 'not_found',
  CONFLICT: 'conflict',
  SERVER: 'server',
  TIMEOUT: 'timeout',
  RATE_LIMIT: 'rate_limit',
  UNKNOWN: 'unknown',
};

export const USER_MESSAGES = {
  // Network errors
  'network_error': 'Unable to connect to the server. Please check your internet connection.',
  'timeout': 'The request took too long. Please try again.',
  'connection_refused': 'Cannot reach the server. Check your internet connection.',
  'no_response': 'The server did not respond. Please try again.',
  
  // Validation errors
  'validation_error': 'Please check your input and try again.',
  'missing_field': 'Please fill in all required fields.',
  'invalid_email': 'Please enter a valid email address.',
  'invalid_phone': 'Please enter a valid phone number.',
  'invalid_price': 'Please enter a valid price.',
  'invalid_quantity': 'Please enter a valid quantity.',
  
  // Authentication errors
  'login_failed': 'Incorrect email or password.',
  'account_not_found': 'No account found with this email.',
  'session_expired': 'Your session has expired. Please log in again.',
  'unauthorized': 'Your session has expired. Please log in again.',
  'invalid_token': 'Invalid authentication. Please log in again.',
  
  // Authorization errors
  'forbidden': 'You do not have permission to perform this action.',
  'insufficient_permissions': 'You do not have permission to perform this action.',
  'admin_only': 'Only administrators can perform this action.',
  
  // Resource errors
  'not_found': 'The item you are looking for does not exist.',
  'already_exists': 'This item already exists.',
  'conflict': 'This action conflicts with existing data.',
  'cannot_delete': 'This item cannot be deleted because it is in use.',
  
  // Rate limiting
  'rate_limit': 'Too many requests. Please wait a moment before trying again.',
  'too_many_requests': 'Too many requests. Please wait a moment before trying again.',
  
  // Server errors
  'server_error': 'Server error. Our team has been notified. Please try again later.',
  'service_unavailable': 'The service is temporarily unavailable. Please try again later.',
  'bad_gateway': 'There was a temporary issue. Please try again.',
  
  // Upload errors
  'file_too_large': 'File is too large. Maximum size is 5MB.',
  'invalid_file_type': 'File type is not supported.',
  'file_required': 'Please select a file to upload.',
};

/**
 * Classify error type from response
 * @param {Error|Object} error - Axios error object
 * @returns {string} Error type from ERROR_TYPES
 */
export const classifyError = (error) => {
  if (!error.response && error.request) {
    // Request made but no response (network error)
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return ERROR_TYPES.TIMEOUT;
    }
    if (error.code === 'ECONNREFUSED') {
      return ERROR_TYPES.NETWORK;
    }
    return ERROR_TYPES.NETWORK;
  }
  
  if (!error.response && !error.request) {
    // Request not made (network error)
    return ERROR_TYPES.NETWORK;
  }
  
  // Response received with error status
  const status = error.response?.status;
  
  if (status === 400) return ERROR_TYPES.VALIDATION;
  if (status === 401) return ERROR_TYPES.AUTHENTICATION;
  if (status === 403) return ERROR_TYPES.AUTHORIZATION;
  if (status === 404) return ERROR_TYPES.NOT_FOUND;
  if (status === 409) return ERROR_TYPES.CONFLICT;
  if (status === 429) return ERROR_TYPES.RATE_LIMIT;
  if (status >= 500) return ERROR_TYPES.SERVER;
  
  return ERROR_TYPES.UNKNOWN;
};

/**
 * Get user-friendly error message from error object
 * @param {Error|Object} error - Axios error object
 * @param {string} defaultKey - Default message key if no specific message found
 * @returns {string} User-friendly error message
 */
export const getUserFriendlyMessage = (error, defaultKey = 'server_error') => {
  // Try to get message from server response
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  
  // Classify error and get appropriate message
  const errorType = classifyError(error);
  
  if (errorType === ERROR_TYPES.TIMEOUT) {
    return USER_MESSAGES['timeout'];
  }
  
  if (errorType === ERROR_TYPES.NETWORK) {
    if (error.code === 'ECONNREFUSED') {
      return USER_MESSAGES['connection_refused'];
    }
    return USER_MESSAGES['network_error'];
  }
  
  if (errorType === ERROR_TYPES.AUTHENTICATION) {
    return USER_MESSAGES['session_expired'];
  }
  
  if (errorType === ERROR_TYPES.AUTHORIZATION) {
    return USER_MESSAGES['forbidden'];
  }
  
  if (errorType === ERROR_TYPES.NOT_FOUND) {
    return USER_MESSAGES['not_found'];
  }
  
  if (errorType === ERROR_TYPES.CONFLICT) {
    return USER_MESSAGES['already_exists'];
  }
  
  if (errorType === ERROR_TYPES.RATE_LIMIT) {
    return USER_MESSAGES['rate_limit'];
  }
  
  if (errorType === ERROR_TYPES.SERVER) {
    return USER_MESSAGES['server_error'];
  }
  
  return USER_MESSAGES[defaultKey] || 'Something went wrong. Please try again.';
};

/**
 * Format error for display with context
 * @param {Error|Object} error - Axios error object
 * @returns {Object} Formatted error with message and type
 */
export const formatError = (error) => {
  return {
    type: classifyError(error),
    message: getUserFriendlyMessage(error),
    statusCode: error.response?.status,
    code: error.response?.data?.code,
    isNetworkError: !error.response && error.request,
    isServerError: error.response?.status >= 500,
    isClientError: error.response?.status >= 400 && error.response?.status < 500,
  };
};

/**
 * Retry logic for specific error types
 * @param {Error|Object} error - Axios error object
 * @param {number} attemptCount - Number of attempts made
 * @returns {boolean} Whether the request should be retried
 */
export const shouldRetryRequest = (error, attemptCount = 0) => {
  const maxAttempts = 3;
  
  if (attemptCount >= maxAttempts) {
    return false;
  }
  
  const errorType = classifyError(error);
  
  // Retry network errors, timeouts, and 5xx errors
  if ([ERROR_TYPES.NETWORK, ERROR_TYPES.TIMEOUT, ERROR_TYPES.SERVER].includes(errorType)) {
    return true;
  }
  
  // Don't retry client errors (4xx) except 429 (rate limit)
  if (errorType === ERROR_TYPES.RATE_LIMIT) {
    return true;
  }
  
  return false;
};

/**
 * Calculate retry delay with exponential backoff
 * @param {number} attemptCount - Number of attempts made
 * @param {number} baseDelay - Base delay in milliseconds (default 1000)
 * @returns {number} Delay in milliseconds
 */
export const getRetryDelay = (attemptCount = 0, baseDelay = 1000) => {
  return baseDelay * Math.pow(2, attemptCount) + Math.random() * 1000;
};
