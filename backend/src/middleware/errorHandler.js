import supabaseImport from '../config/supabase.js';
import logger from '../utils/logger.js';
import { getDefaultErrorMessage, sendError } from '../utils/apiResponse.js';

let injectedSupabase = null;
const getSupabase = () => injectedSupabase || supabaseImport;

const TECHNICAL_ERROR_PATTERN =
  /(sql|stack|supabase|postgres|database|jwt|tokenexpired|jsonwebtoken|column|constraint|relation|syntax error|cannot read|undefined|null)/i;

const normalizeStatusCode = (err) => {
  const statusCode = Number(err?.statusCode || err?.status || 500);
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

  if (statusCode >= 500 || TECHNICAL_ERROR_PATTERN.test(candidate)) {
    return getDefaultErrorMessage(statusCode);
  }

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
  const isDeveloper = req?.user?.role === 'developer';

  console.error('🔥 INTERNAL ERROR:', error);

  logger.error('Unhandled Error:', {
    message: error?.message || 'Unknown error',
    stack: error?.stack || 'No stack trace',
    endpoint: req?.originalUrl || req?.path || 'unknown',
    method: req?.method || 'unknown',
    userId: req?.user?.userId || null,
    restaurantId: req?.restaurantId || req?.user?.restaurantId || null,
    role: req?.user?.role || '',
    statusCode,
    timestamp: new Date().toISOString(),
  });

  await persistErrorLog(req, error, statusCode, safeMessage);

  if (isDeveloper) {
    return res.status(statusCode).json({
      success: false,
      statusCode,
      message: error?.message || safeMessage,
      stack: error?.stack || null,
      details: serializeDeveloperDetails(error),
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
