export const ERROR_CODES = {
  // Authentication errors
  INVALID_CREDENTIALS: { code: 'AUTH_001', statusCode: 401, message: 'Invalid email or password' },
  TOKEN_EXPIRED: { code: 'AUTH_002', statusCode: 401, message: 'Token has expired' },
  INVALID_TOKEN: { code: 'AUTH_003', statusCode: 401, message: 'Invalid token' },
  UNAUTHORIZED: { code: 'AUTH_004', statusCode: 401, message: 'Unauthorized access' },
  
  // Validation errors
  VALIDATION_ERROR: { code: 'VAL_001', statusCode: 400, message: 'Validation failed' },
  INVALID_EMAIL: { code: 'VAL_002', statusCode: 400, message: 'Invalid email format' },
  WEAK_PASSWORD: { code: 'VAL_003', statusCode: 400, message: 'Password is too weak' },
  
  // Resource errors
  NOT_FOUND: { code: 'RES_001', statusCode: 404, message: 'Resource not found' },
  ALREADY_EXISTS: { code: 'RES_002', statusCode: 409, message: 'Resource already exists' },
  CONFLICT: { code: 'RES_003', statusCode: 409, message: 'Resource conflict' },
  
  // Business logic errors
  INSUFFICIENT_PERMISSIONS: { code: 'BIZ_001', statusCode: 403, message: 'Insufficient permissions' },
  INVALID_STATE: { code: 'BIZ_002', statusCode: 400, message: 'Invalid state transition' },
  
  // Server errors
  INTERNAL_ERROR: { code: 'SRV_001', statusCode: 500, message: 'Internal server error' },
  DATABASE_ERROR: { code: 'SRV_002', statusCode: 500, message: 'Database error' },
  EXTERNAL_SERVICE_ERROR: { code: 'SRV_003', statusCode: 503, message: 'External service error' },
};

export class AppError extends Error {
  constructor(errorCode, customMessage = null) {
    const error = ERROR_CODES[errorCode];
    super(customMessage || error.message);
    this.code = error.code;
    this.statusCode = error.statusCode;
    this.errorCode = errorCode;
  }
}
