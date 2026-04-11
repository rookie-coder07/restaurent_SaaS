import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import logger from '../utils/logger.js';
import supabase from '../config/supabase.js';

/**
 * TOKEN EXPIRY & REFRESH TOKEN MANAGEMENT
 * Implements secure JWT token rotation and refresh token storage
 */

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-min-32-characters-change-this-in-production';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'your-super-secret-refresh-token-key-min-32-characters';

// Token expiry times
export const TOKEN_CONFIG = {
  ACCESS_TOKEN_EXPIRY: '1h',           // 1 hour
  REFRESH_TOKEN_EXPIRY: '7d',          // 7 days
  ACCESS_TOKEN_SECONDS: 3600,          // 1 hour in seconds
  REFRESH_TOKEN_SECONDS: 604800,       // 7 days in seconds
};

/**
 * Generate JWT access token with 1-hour expiry
 */
export const generateAccessToken = (userId, restaurantId, email, role) => {
  const payload = {
    userId,
    restaurantId,
    email,
    role,
    type: 'access',
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY,
    issuer: 'pos-saas',
    audience: 'pos-saas-app',
  });
};

/**
 * Generate JWT refresh token with 7-day expiry
 */
export const generateRefreshToken = (userId, restaurantId, email, role) => {
  const payload = {
    userId,
    restaurantId,
    email,
    role,
    type: 'refresh',
  };

  return jwt.sign(payload, REFRESH_TOKEN_SECRET, {
    expiresIn: TOKEN_CONFIG.REFRESH_TOKEN_EXPIRY,
    issuer: 'pos-saas',
    audience: 'pos-saas-app',
  });
};

/**
 * Verify access token
 */
export const verifyAccessToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'pos-saas',
      audience: 'pos-saas-app',
    });

    if (decoded.type !== 'access') {
      throw new Error('Invalid token type');
    }

    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Access token has expired. Please refresh your token.');
    }
    throw new Error('Invalid access token');
  }
};

/**
 * Verify refresh token and check against database
 */
export const verifyRefreshToken = async (token) => {
  try {
    const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET, {
      issuer: 'pos-saas',
      audience: 'pos-saas-app',
    });

    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    // Check if refresh token is stored and valid in database
    const { data: tokenRecord, error } = await supabase
      .from('refresh_tokens')
      .select('*')
      .eq('token_hash', hashToken(token))
      .eq('is_revoked', false)
      .eq('user_id', decoded.userId)
      .maybeSingle();

    if (error) {
      const message = error?.message || '';
      const isMissingTable =
        message.toLowerCase().includes('refresh_tokens') ||
        message.toLowerCase().includes('schema cache') ||
        error.code === 'PGRST116' || // table not found
        error.code === 'PGRST204' || // schema cache missing
        error.code === '42P01';      // postgres undefined table

      if (isMissingTable) {
        logger.warn('Refresh token table missing; falling back to stateless validation', {
          userId: decoded.userId,
        });
        return decoded;
      }

      logger.warn('Refresh token lookup failed', {
        userId: decoded.userId,
        error: message,
      });
      throw new Error('Refresh token lookup failed');
    }

    if (!tokenRecord) {
      logger.warn('Refresh token not found or revoked', {
        userId: decoded.userId,
      });
      throw new Error('Refresh token is invalid or has been revoked');
    }

    // Check if token has expired
    if (new Date(tokenRecord.expires_at) < new Date()) {
      throw new Error('Refresh token has expired');
    }

    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Refresh token has expired. Please log in again.');
    }
    throw error;
  }
};

/**
 * Store refresh token in database
 */
export const storeRefreshToken = async (token, userId, restaurantId, expiresAt) => {
  try {
    const tokenFamily = generateTokenFamily();
    const tokenHash = hashToken(token);

    const { data, error } = await supabase
      .from('refresh_tokens')
      .insert([{
        user_id: userId,
        restaurant_id: restaurantId,
        token_hash: tokenHash,
        token_family: tokenFamily,
        is_revoked: false,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
        last_used_at: new Date().toISOString(),
      }])
      .select('id');

    if (error) {
      const message = error?.message || '';
      const isMissingTable =
        message.toLowerCase().includes('refresh_tokens') ||
        message.toLowerCase().includes('schema cache') ||
        error.code === 'PGRST116' ||
        error.code === 'PGRST204' ||
        error.code === '42P01';

      if (isMissingTable) {
        logger.warn('Refresh token table missing; skipping persistence', {
          userId,
        });
        return {
          tokenId: null,
          tokenFamily: 'stateless',
        };
      }

      logger.error('Failed to store refresh token', {
        userId,
        error: error.message,
      });
      throw error;
    }

    logger.info('Refresh token stored', {
      userId,
      tokenFamily,
    });

    return {
      tokenId: data[0].id,
      tokenFamily,
    };
  } catch (error) {
    logger.error('Error storing refresh token', error);
    throw error;
  }
};

/**
 * Revoke refresh token (logout)
 */
export const revokeRefreshToken = async (token) => {
  try {
    const tokenHash = hashToken(token);

    const { error } = await supabase
      .from('refresh_tokens')
      .update({ is_revoked: true, revoked_at: new Date().toISOString() })
      .eq('token_hash', tokenHash);

    if (error) {
      const message = error?.message || '';
      const isMissingTable =
        message.toLowerCase().includes('refresh_tokens') ||
        message.toLowerCase().includes('schema cache') ||
        error.code === 'PGRST116' ||
        error.code === 'PGRST204' ||
        error.code === '42P01';

      if (isMissingTable) {
        logger.warn('Refresh token table missing; skipping revoke');
        return true;
      }

      logger.error('Failed to revoke refresh token', error);
      throw error;
    }

    logger.info('Refresh token revoked');
    return true;
  } catch (error) {
    logger.error('Error revoking refresh token', error);
    throw error;
  }
};

/**
 * Revoke all refresh tokens for a user (when password changes)
 */
export const revokeAllUserTokens = async (userId) => {
  try {
    const { error } = await supabase
      .from('refresh_tokens')
      .update({ is_revoked: true, revoked_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_revoked', false);

    if (error) throw error;

    logger.warn('All refresh tokens revoked for user', { userId });
    return true;
  } catch (error) {
    const message = error?.message || '';
    const isMissingTable =
      message.toLowerCase().includes('refresh_tokens') ||
      message.toLowerCase().includes('schema cache') ||
      error.code === 'PGRST116' ||
      error.code === 'PGRST204' ||
      error.code === '42P01';

    if (isMissingTable) {
      logger.warn('Refresh token table missing; skip bulk revoke', { userId });
      return true;
    }
    logger.error('Error revoking all user tokens', error);
    throw error;
  }
};

/**
 * Create new token pair with rotation
 * Invalidates old refresh token on rotation
 */
export const rotateRefreshToken = async (oldToken, userId, restaurantId) => {
  try {
    // Verify old token
    const decoded = await verifyRefreshToken(oldToken);

    // Generate new token pair
    const newAccessToken = generateAccessToken(
      decoded.userId,
      decoded.restaurantId,
      decoded.email,
      decoded.role
    );

    const newRefreshToken = generateRefreshToken(
      decoded.userId,
      decoded.restaurantId,
      decoded.email,
      decoded.role
    );

    // Calculate expiry for new refresh token
    const expiresAt = new Date(Date.now() + TOKEN_CONFIG.REFRESH_TOKEN_SECONDS * 1000).toISOString();

    // Store new refresh token
    let tokenMetadata = { tokenFamily: 'stateless' };
    try {
      tokenMetadata = await storeRefreshToken(
        newRefreshToken,
        userId || decoded.userId,
        restaurantId || decoded.restaurantId,
        expiresAt
      );
    } catch (storeError) {
      logger.warn('Refresh token store unavailable; continuing with stateless tokens', {
        error: storeError.message,
      });
    }

    // Revoke old refresh token (best effort)
    try {
      await revokeRefreshToken(oldToken);
    } catch (revokeError) {
      logger.warn('Failed to revoke previous refresh token', { error: revokeError.message });
    }

    logger.info('Refresh token rotated', {
      userId: userId || decoded.userId,
      tokenFamily: tokenMetadata.tokenFamily,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: TOKEN_CONFIG.ACCESS_TOKEN_SECONDS,
      refreshExpiresIn: TOKEN_CONFIG.REFRESH_TOKEN_SECONDS,
      tokenType: 'Bearer',
    };
  } catch (error) {
    logger.error('Token rotation failed', error);
    throw error;
  }
};

/**
 * Clean up expired tokens from database
 */
export const cleanupExpiredTokens = async () => {
  try {
    const { error } = await supabase
      .from('refresh_tokens')
      .delete()
      .lt('expires_at', new Date().toISOString());

    if (error) {
      const message = error?.message || '';
      const isMissingTable =
        message.toLowerCase().includes('refresh_tokens') ||
        message.toLowerCase().includes('schema cache') ||
        error.code === 'PGRST116' ||
        error.code === 'PGRST204' ||
        error.code === '42P01';

      if (isMissingTable) {
        logger.warn('Refresh token table missing; skipping cleanup');
        return false;
      }

      throw error;
    }

    logger.info('Expired tokens cleaned up');
    return true;
  } catch (error) {
    logger.error('Token cleanup failed', error);
    return false;
  }
};

/**
 * Detect token reuse attack
 * Check if token family is being used to generate multiple token branches
 */
export const detectTokenReuseAttack = async (tokenFamily, userId) => {
  try {
    const { data: tokens, error } = await supabase
      .from('refresh_tokens')
      .select('id, token_family, created_at')
      .eq('token_family', tokenFamily)
      .eq('user_id', userId);

    if (error) {
      const message = error?.message || '';
      const isMissingTable =
        message.toLowerCase().includes('refresh_tokens') ||
        message.toLowerCase().includes('schema cache') ||
        error.code === 'PGRST116' ||
        error.code === 'PGRST204' ||
        error.code === '42P01';

      if (isMissingTable) {
        logger.warn('Refresh token table missing; skipping reuse detection', { userId });
        return false;
      }

      throw error;
    }

    // If multiple non-revoked tokens from same family exist, it's a potential reuse attack
    const activeTokens = tokens.filter(t => !t.is_revoked);
    
    if (activeTokens.length > 1) {
      logger.error('Potential token reuse attack detected', {
        userId,
        tokenFamily,
        activeTokenCount: activeTokens.length,
      });

      // Revoke all tokens from this family
      await supabase
        .from('refresh_tokens')
        .update({ is_revoked: true })
        .eq('token_family', tokenFamily);

      return true; // Attack detected
    }

    return false;
  } catch (error) {
    logger.error('Error detecting token reuse', error);
    return false;
  }
};

/**
 * HELPER FUNCTIONS
 */

// Generate unique token family identifier
function generateTokenFamily() {
  return `tf_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

// Hash token for secure storage (never store plain tokens)
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Get token expiry info
export const getTokenExpiryInfo = () => ({
  accessTokenExpiry: TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY,
  accessTokenSeconds: TOKEN_CONFIG.ACCESS_TOKEN_SECONDS,
  refreshTokenExpiry: TOKEN_CONFIG.REFRESH_TOKEN_EXPIRY,
  refreshTokenSeconds: TOKEN_CONFIG.REFRESH_TOKEN_SECONDS,
});

export default {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  storeRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  rotateRefreshToken,
  cleanupExpiredTokens,
  detectTokenReuseAttack,
  getTokenExpiryInfo,
  TOKEN_CONFIG,
};
