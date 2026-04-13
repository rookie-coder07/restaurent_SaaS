export class ApiResponse {
  constructor(statusCode, data, message = 'Success') {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
  }
}

export const DEFAULT_ERROR_MESSAGES = {
  400: 'Please check your input and try again',
  401: 'Your session has expired. Please log in again',
  403: 'You do not have permission to perform this action',
  404: 'The resource you are looking for does not exist',
  408: 'Request took too long. Please try again',
  409: 'This item already exists or action cannot be completed',
  429: 'Too many requests. Please wait a moment before trying again',
  500: 'Server error. Please try again later',
  503: 'Service is temporarily unavailable. Please try again soon',
};

// Specific error messages for common scenarios
export const SPECIFIC_ERROR_MESSAGES = {
  // Authentication
  'invalid_login': 'Incorrect email or password',
  'account_not_found': 'No account found with this email',
  'password_mismatch': 'The passwords do not match',
  'weak_password': 'Password must be at least 8 characters',
  'email_taken': 'This email is already registered',
  'session_expired': 'Your session has expired. Please log in again',
  'invalid_token': 'Invalid or expired authentication token',
  
  // Validation
  'missing_field': 'Please fill in all required fields',
  'invalid_email': 'Please enter a valid email address',
  'invalid_phone': 'Please enter a valid phone number',
  'invalid_price': 'Price must be a valid number',
  'invalid_quantity': 'Quantity must be a positive number',
  
  // Permissions
  'insufficient_permissions': 'You do not have permission to perform this action',
  'admin_only': 'Only administrators can perform this action',
  'owner_only': 'Only restaurant owners can perform this action',
  
  // Resource operations
  'not_found': 'The item you are looking for does not exist',
  'already_exists': 'This item already exists',
  'cannot_delete': 'This item cannot be deleted because it is in use',
  'cannot_update': 'This item cannot be updated',
  
  // Network
  'network_error': 'Check your internet connection and try again',
  'timeout': 'The request took too long. Please try again',
  'server_error': 'Server error. Our team has been notified. Please try again later',
  
  // Rate limiting
  'rate_limit': 'Too many requests. Please wait a moment before trying again',
  'rate_limit_auth': 'Too many login attempts. Please wait before trying again',
  
  // Upload
  'file_too_large': 'File is too large. Maximum size is 5MB',
  'invalid_file_type': 'File type is not supported',
  'file_required': 'Please select a file to upload',
};

export const getDefaultErrorMessage = (statusCode = 500) =>
  DEFAULT_ERROR_MESSAGES[statusCode] || DEFAULT_ERROR_MESSAGES[500];

export const sendSuccess = (res, statusCode = 200, data = null, message = 'Success') => {
  if (!res || !res.status || !res.json) {
    return null;
  }
  return res.status(statusCode || 200).json(
    new ApiResponse(statusCode || 200, data, message || 'Success')
  );
};

export const sendError = (res, statusCode = 500, message = 'Internal Server Error', errors = null) => {
  if (!res || !res.status || !res.json) {
    return null;
  }

  const normalizedStatusCode = Number(statusCode) || 500;
  const safeMessage = message || getDefaultErrorMessage(normalizedStatusCode);

  return res.status(statusCode || 500).json({
    statusCode: normalizedStatusCode,
    data: null,
    message: safeMessage,
    errors,
    success: false,
  });
};
