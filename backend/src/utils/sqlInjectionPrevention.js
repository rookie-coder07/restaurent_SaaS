import { logWarn, logError } from '../utils/logger.js';
import SecurityAuditLogger from './securityAudit.js';

const SQL_INJECTION_PATTERNS = [
  /(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|SCRIPT|JAVASCRIPT|ONERROR|ONLOAD)\b)/gi,
  /(-{2}|\/\*|\*\/|;)/g, // Comments and statement terminators
  /(['"`].*['"`])/g, // String literals
  /(and|or|not)\s*(\d+|[\w]+)\s*=/gi, // Logical operators with conditions
];

const XSS_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /javascript:/gi,
  /onerror\s*=/gi,
  /onload\s*=/gi,
  /on\w+\s*=/gi,
];

export const detectSQLInjection = (input, fieldName = 'input') => {
  if (!input || typeof input !== 'string') {
    return false;
  }

  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return true;
    }
  }

  return false;
};

export const detectXSSAttempt = (input, fieldName = 'input') => {
  if (!input || typeof input !== 'string') {
    return false;
  }

  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(input)) {
      return true;
    }
  }

  return false;
};

export const validateQueryParameter = (value, expectedType = 'string', maxLength = 255) => {
  if (value === undefined || value === null) {
    return { valid: false, error: 'Parameter required' };
  }

  if (typeof value !== expectedType) {
    return { valid: false, error: `Expected ${expectedType}, got ${typeof value}` };
  }

  if (typeof value === 'string') {
    if (value.length === 0) {
      return { valid: false, error: 'Parameter cannot be empty' };
    }

    if (value.length > maxLength) {
      return { valid: false, error: `Parameter exceeds max length of ${maxLength}` };
    }

    // Check for injection attempts
    if (detectSQLInjection(value)) {
      SecurityAuditLogger.logSQLInjectionAttempt('unknown', value, 'unknown', 'unknown');
      return { valid: false, error: 'Invalid parameter' };
    }

    if (detectXSSAttempt(value)) {
      SecurityAuditLogger.logXSSAttempt('unknown', value, 'unknown', 'unknown');
      return { valid: false, error: 'Invalid parameter' };
    }
  }

  return { valid: true };
};

export const sanitizeQueryString = (str) => {
  if (typeof str !== 'string') {
    return str;
  }

  // Remove potentially dangerous SQL characters
  return str
    .replace(/['"%]/g, '') // Remove quotes and percent
    .replace(/;/g, '') // Remove statement terminator
    .replace(/--/g, '') // Remove comment syntax
    .substring(0, 255);
};

export const buildSafeQuery = (baseQuery, filters) => {
  if (!filters || typeof filters !== 'object') {
    return baseQuery;
  }

  let query = baseQuery;

  for (const [key, value] of Object.entries(filters)) {
    // Never concatenate directly - use placeholder system
    const validation = validateQueryParameter(value);

    if (!validation.valid) {
      logWarn('Invalid query parameter', {
        parameter: key,
        error: validation.error,
      });
      continue;
    }

    // Use parameterized query approach (Supabase handles this)
    // Don't concatenate SQL strings
    query = query.eq(key, value);
  }

  return query;
};

export const preventSQLInjection = (req, res, next) => {
  // Check all query parameters
  for (const [key, value] of Object.entries(req.query || {})) {
    if (typeof value === 'string' && detectSQLInjection(value)) {
      logWarn('SQL injection attempt detected', {
        parameter: key,
        ip: req.ip,
        path: req.path,
      });

      SecurityAuditLogger.logSQLInjectionAttempt(req.user?.id, value, req.path, req.ip);

      return res.status(400).json({
        success: false,
        message: 'Invalid query parameter',
      });
    }
  }

  // Check request body
  if (req.body && typeof req.body === 'object') {
    for (const [key, value] of Object.entries(req.body)) {
      if (typeof value === 'string' && detectSQLInjection(value)) {
        logWarn('SQL injection attempt detected in body', {
          field: key,
          ip: req.ip,
          path: req.path,
        });

        SecurityAuditLogger.logSQLInjectionAttempt(req.user?.id, value, req.path, req.ip);

        return res.status(400).json({
          success: false,
          message: 'Invalid input',
        });
      }
    }
  }

  next();
};

export const preventXSS = (req, res, next) => {
  // Check request body
  if (req.body && typeof req.body === 'object') {
    for (const [key, value] of Object.entries(req.body)) {
      if (typeof value === 'string' && detectXSSAttempt(value)) {
        logWarn('XSS attempt detected', {
          field: key,
          ip: req.ip,
          path: req.path,
        });

        SecurityAuditLogger.logXSSAttempt(req.user?.id, value, key, req.ip);

        return res.status(400).json({
          success: false,
          message: 'Invalid input',
        });
      }
    }
  }

  next();
};
