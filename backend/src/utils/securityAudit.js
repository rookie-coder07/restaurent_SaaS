import logger from './logger.js';

export class SecurityAuditLogger {
  static logLoginAttempt(email, success, ip, reason = null) {
    const logFn = success ? logger.info : logger.warn;
    logFn(`LOGIN_ATTEMPT_${success ? 'SUCCESS' : 'FAILED'}`, {
      email,
      ip,
      reason: success ? null : reason,
      timestamp: new Date().toISOString(),
    });
  }

  static logPasswordChange(userId, success, ip) {
    const logFn = success ? logger.info : logger.error;
    logFn(`PASSWORD_${success ? 'CHANGED' : 'CHANGE_FAILED'}`, {
      userId,
      ip,
      timestamp: new Date().toISOString(),
    });
  }

  static logUnauthorizedAccess(userId, endpoint, method, ip) {
    logger.warn('UNAUTHORIZED_ACCESS_ATTEMPT', {
      userId: userId || 'unknown',
      endpoint,
      method,
      ip,
      timestamp: new Date().toISOString(),
    });
  }

  static logSuspiciousActivity(userId, activity, details, ip) {
    logger.warn('SUSPICIOUS_ACTIVITY', {
      userId: userId || 'unknown',
      activity,
      details,
      ip,
      timestamp: new Date().toISOString(),
    });
  }

  static logDataAccess(userId, resource, action, ip) {
    logger.info('DATA_ACCESS', {
      userId,
      resource,
      action,
      ip,
      timestamp: new Date().toISOString(),
    });
  }

  static logSecurityEvent(eventType, details, ip, severity = 'info') {
    const logFn = severity === 'critical' ? logger.error :
                  severity === 'warning' ? logger.warn :
                  logger.info;

    logFn(`SECURITY_EVENT_${eventType}`, {
      details,
      ip,
      severity,
      timestamp: new Date().toISOString(),
    });
  }

  static logDatabaseOperation(userId, operation, table, affected, ip) {
    logger.info('DATABASE_OPERATION', {
      userId,
      operation,
      table,
      affected,
      ip,
      timestamp: new Date().toISOString(),
    });
  }

  static logFailedValidation(userId, field, value, reason, ip) {
    logger.warn('VALIDATION_FAILED', {
      userId: userId || 'unknown',
      field,
      valueType: typeof value,
      reason,
      ip,
      timestamp: new Date().toISOString(),
    });
  }

  static logRateLimitExceeded(userId, endpoint, ip, limit, window) {
    logger.warn('RATE_LIMIT_EXCEEDED', {
      userId: userId || 'unknown',
      endpoint,
      ip,
      limit,
      window,
      timestamp: new Date().toISOString(),
    });
  }

  static logSQLInjectionAttempt(userId, input, endpoint, ip) {
    logger.error('SQL_INJECTION_ATTEMPT_DETECTED', {
      userId: userId || 'unknown',
      endpoint,
      inputType: typeof input,
      ip,
      timestamp: new Date().toISOString(),
      severity: 'CRITICAL',
    });
  }

  static logXSSAttempt(userId, input, field, ip) {
    logger.error('XSS_ATTEMPT_DETECTED', {
      userId: userId || 'unknown',
      field,
      inputType: typeof input,
      ip,
      timestamp: new Date().toISOString(),
      severity: 'CRITICAL',
    });
  }

  static logCrossOriginRequest(origin, endpoint, allowed, ip) {
    if (!allowed) {
      logger.warn('CORS_BLOCKED', {
        origin,
        endpoint,
        ip,
        timestamp: new Date().toISOString(),
      });
    }
  }

  static logPrivilegeEscalationAttempt(userId, attemptedRole, currentRole, ip) {
    logger.error('PRIVILEGE_ESCALATION_ATTEMPT', {
      userId,
      attemptedRole,
      currentRole,
      ip,
      timestamp: new Date().toISOString(),
      severity: 'CRITICAL',
    });
  }

  static logCriticalOperation(userId, operation, details, ip) {
    logger.error('CRITICAL_OPERATION', {
      userId,
      operation,
      details,
      ip,
      timestamp: new Date().toISOString(),
    });
  }

  static getAuditLog(filter = {}) {
    // This would typically query an audit log table
    // For now, just logging structure
    return {
      message: 'Audit log query would be executed here',
      filter,
    };
  }
}

export default SecurityAuditLogger;
