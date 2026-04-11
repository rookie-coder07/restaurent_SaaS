export class ApiResponse {
  constructor(statusCode, data, message = 'Success') {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
  }
}

export const DEFAULT_ERROR_MESSAGES = {
  400: 'Invalid request data',
  401: 'Unauthorized access',
  403: 'Access denied',
  404: 'Resource not found',
  408: 'Request timed out',
  409: 'Request could not be completed',
  429: 'Too many requests. Please try again later.',
  500: 'Something went wrong. Please try again.',
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
