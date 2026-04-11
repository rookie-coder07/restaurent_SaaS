import bcrypt from 'bcryptjs';
import { logError, logInfo, logWarn } from '../utils/logger.js';

const SALT_ROUNDS = 12;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

export const hashPassword = async (password) => {
  try {
    if (!password || typeof password !== 'string') {
      throw new Error('Invalid password');
    }

    if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
      throw new Error(`Password must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters`);
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    logInfo('Password hashed', {
      haslength: hashedPassword.length,
    });

    return hashedPassword;
  } catch (error) {
    logError('Password hashing failed', error);
    throw error;
  }
};

export const verifyPassword = async (plainPassword, hashedPassword) => {
  try {
    if (!plainPassword || !hashedPassword) {
      return false;
    }

    const isValid = await bcrypt.compare(plainPassword, hashedPassword);
    return isValid;
  } catch (error) {
    logError('Password verification failed', error);
    return false;
  }
};

export const validatePasswordStrength = (password) => {
  const errors = [];

  if (!password) {
    errors.push('Password is required');
    return { valid: false, errors };
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    errors.push(`Password must be at most ${PASSWORD_MAX_LENGTH} characters`);
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const generateSecurePassword = (length = 16) => {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*';

  const chars = uppercase + lowercase + numbers + special;
  let password = '';

  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }

  // Shuffle
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
};

export const logFailedLogin = (email, reason, ip) => {
  logWarn('Failed login attempt', {
    email,
    reason,
    ip,
    timestamp: new Date().toISOString(),
  });
};

export const logSuccessfulLogin = (userId, email) => {
  logInfo('Successful login', {
    userId,
    email,
    timestamp: new Date().toISOString(),
  });
};

export const logPasswordChange = (userId, email) => {
  logInfo('Password changed', {
    userId,
    email,
    timestamp: new Date().toISOString(),
  });
};

export const logUnauthorizedAccess = (userId, resource, reason, ip) => {
  logWarn('Unauthorized access attempt', {
    userId,
    resource,
    reason,
    ip,
    timestamp: new Date().toISOString(),
  });
};
