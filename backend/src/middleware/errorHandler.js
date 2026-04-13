import supabaseImport from '../config/supabase.js';
import logger from '../utils/logger.js';
import { getDefaultErrorMessage, sendError } from '../utils/apiResponse.js';

let injectedSupabase = null;
const getSupabase = () => injectedSupabase || supabaseImport;

const TECHNICAL_ERROR_PATTERN =
  /(sql|stack|supabase|postgres|database|jwt|tokenexpired|jsonwebtoken|column|constraint|relation|syntax error|cannot read|undefined|null)/i;

const normalizeStatusCode = (err) => {
  const statusCode = Number(err?.statusCode || err?.status || 500);
  const message = String(err?.message || err?.publicMessage || '').toLowerCase();
  
  // Check for authentication failures
  if (message.includes('invalid') && (message.includes('credentials') || message.includes('password'))) {
    return 401;
  }
  
  // Check for rate limit errors
  if (err.statusCode === 429 || statusCode === 429 || message.includes('rate limit')) {
    return 429;
  }
  
  // Check for duplicate/conflict errors
  if (message.includes('unique constraint') || message.includes('already exists') || message.includes('duplicate') || err.statusCode === 409) {
    return 409;
  }
  
  // Check for validation errors
  if (message.includes('invalid') || message.includes('required') || err.statusCode === 400) {
    return 400;
  }
  
  // Check for admin client initialization errors (missing service role key)
  if (message.includes('admin client') || message.includes('service role key')) {
    // Return 503 Service Unavailable - backend infrastructure issue, not user error
    return 503;
  }
  
  if ([400, 401, 403, 404, 409, 408, 429].includes(statusCode)) {
    return statusCode;
  }
  return 500;
};

const buildSafeMessage = (err, statusCode) => {
  const candidate = String(err?.publicMessage || err?.message || '').trim();

  if (!candidate) {
    return getDefaultErrorMessage(statusCode);
  }

  // Service role key errors should be shown to all users (informative)
  if (candidate.includes('SUPABASE_SERVICE_ROLE_KEY') || candidate.includes('admin client')) {
    return 'Backend configuration error. Please contact support. The server is unable to process admin operations.';
  }

  // Specific error patterns - provide user-friendly messages
  if (candidate.includes('duplicate') || candidate.includes('already exists')) {
    return 'This item already exists. Please use a different value.';
  }
  
  if (candidate.includes('foreign key')) {
    return 'Cannot complete this action. Required data is missing or invalid.';
  }
  
  if (candidate.includes('not found') || candidate.includes('does not exist')) {
    return 'The item you are looking for does not exist.';
  }
  
  if (candidate.includes('permission') || candidate.includes('denied')) {
    return 'You do not have permission to perform this action.';
  }
  
  if (candidate.includes('invalid input') || candidate.includes('validation')) {
    return 'Please check your input and try again.';
  }
  
  if (candidate.includes('network') || candidate.includes('connection')) {
    return 'Network error. Please check your connection and try again.';
  }
  
  if (candidate.includes('timeout')) {
    return 'Request took too long. Please try again.';
  }

  // If message is technical, use default error message
  if (statusCode >= 500 || TECHNICAL_ERROR_PATTERN.test(candidate)) {
    return getDefaultErrorMessage(statusCode);
  }

  // Return the safe message if it doesn't contain technical details
  return candidate;
};

const serializeDeveloperDetails = (err) => ({
  name: err?.name || 'Error',
  code: err?.code || null,
  statusCode: err?.statusCode || err?.status || 500,
  details: err?.details || null,
  hint: err?.hint || null,
});

const persistErrorLog = async (req, err, statusCode, safeMessage) => {
  const payload = {
    user_id: req?.user?.userId || null,
    endpoint: req?.originalUrl || req?.path || '',
    error_message: String(err?.message || safeMessage || getDefaultErrorMessage(statusCode)).slice(0, 2000),
    timestamp: new Date().toISOString(),
    status_code: statusCode,
    method: req?.method || '',
    role: req?.user?.role || '',
  };

  try {
    const { error } = await getSupabase().from('error_logs').insert([payload]);
    if (!error) {
      return;
    }
  } catch {
    // Fall through to activity_logs.
  }

  try {
    const activityPayload = {
      restaurant_id: req?.restaurantId || req?.user?.restaurantId || null,
      user_id: req?.user?.userId || null,
      role: req?.user?.role || 'system',
      action: 'api_error',
      details: {
        endpoint: payload.endpoint,
        error_message: payload.error_message,
        status_code: statusCode,
        method: payload.method,
        safe_message: safeMessage,
      },
      created_at: payload.timestamp,
    };

    await getSupabase().from('activity_logs').insert([activityPayload]);
  } catch (logError) {
    logger.warn('Error log persistence failed', {
      endpoint: payload.endpoint,
      message: logError?.message || 'Unknown persistence error',
    });
  }
};

export const errorHandler = async (err, req, res, next) => {
  if (!res || !res.status || !res.json) {
    return;
  }

  const error = err || new Error('Unknown error');
  const statusCode = normalizeStatusCode(error);
  const safeMessage = buildSafeMessage(error, statusCode);
  const isDeveloper = ['developer'].includes(req?.user?.role);
  
  // Manager debugging: show debug state for "User not found in profile store" errors
  const isManagerError = String(error?.message || '').includes('User not found in profile store');

  // Special logging for admin client errors
  const isAdminClientError = String(error?.message || '').includes('admin client') || 
                             String(error?.message || '').includes('SUPABASE_SERVICE_ROLE_KEY');
  
  if (isAdminClientError) {
    console.error('🔴 ADMIN CLIENT INITIALIZATION FAILED');
    console.error('   This typically means SUPABASE_SERVICE_ROLE_KEY is not configured');
    console.error('   Please check your Render backend environment variables');
    console.error('   Error:', error?.message);
  } else if (isManagerError && error?.debugState) {
    console.error('🟠 MANAGER LOGIN DEBUG:', JSON.stringify(error?.debugState, null, 2));
  } else {
    console.error('🔥 INTERNAL ERROR:', error);
  }

  logger.error('Unhandled Error:', {
    message: error?.message || 'Unknown error',
    stack: error?.stack || 'No stack trace',
    endpoint: req?.originalUrl || req?.path || 'unknown',
    method: req?.method || 'unknown',
    userId: req?.user?.userId || null,
    restaurantId: req?.restaurantId || req?.user?.restaurantId || null,
    role: req?.user?.role || '',
    statusCode,
    isAdminClientError,
    debugState: error?.debugState || null,
    timestamp: new Date().toISOString(),
  });

  await persistErrorLog(req, error, statusCode, safeMessage);

  // Always show debug state for manager errors or for developers
  if (isDeveloper || isManagerError) {
    return res.status(statusCode).json({
      success: false,
      statusCode,
      message: error?.message || safeMessage,
      ...(error?.debugState && { debugState: error.debugState }),
      stack: isDeveloper ? (error?.stack || null) : undefined,
      details: isDeveloper ? serializeDeveloperDetails(error) : undefined,
    });
  }

  return sendError(res, statusCode, safeMessage);
};

export const notFoundHandler = (req, res, next) => {
  logger.warn(`404 Not Found: ${req.method} ${req.path}`);
  return sendError(res, 404, getDefaultErrorMessage(404));
};

export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
