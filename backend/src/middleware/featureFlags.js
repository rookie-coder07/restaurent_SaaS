import supabaseImport from '../config/supabase.js';
import { sendError } from '../utils/apiResponse.js';
import logger from '../utils/logger.js';

let injectedSupabase = null;
const getSupabase = () => injectedSupabase || supabaseImport;

const CACHE_TTL_MS = 15000;
const featureCache = new Map();

function getCacheKey(featureKey, restaurantId = null) {
  return `${restaurantId || 'global'}:${featureKey}`;
}

function readCachedValue(cacheKey) {
  const cached = featureCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  if (cached) {
    featureCache.delete(cacheKey);
  }

  return null;
}

function writeCachedValue(cacheKey, value) {
  featureCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return value;
}

async function fetchFeatureFlag(featureKey, restaurantId = null) {
  const cacheKey = getCacheKey(featureKey, restaurantId);
  const cached = readCachedValue(cacheKey);
  if (cached) {
    return cached;
  }

  let query = getSupabase()
    .from('feature_flags')
    .select('enabled')
    .eq('feature_key', featureKey);

  query = restaurantId
    ? query.eq('restaurant_id', restaurantId)
    : query.is('restaurant_id', null);

  const { data, error } = await query.maybeSingle();
  if (error && error.code !== 'PGRST116' && error.code !== 'PGRST205') {
    throw error;
  }

  const value = {
    enabled: data?.enabled !== false,
  };

  return writeCachedValue(cacheKey, value);
}

export function clearFeatureFlagCache(featureKey = null, restaurantId = null) {
  if (!featureKey) {
    featureCache.clear();
    return;
  }

  featureCache.delete(getCacheKey(featureKey, restaurantId));
  if (restaurantId) {
    return;
  }

  featureCache.delete(getCacheKey(featureKey, null));
}

export async function getEffectiveFeatureFlag(featureKey, restaurantId = null) {
  const restaurantFlag = restaurantId
    ? await fetchFeatureFlag(featureKey, restaurantId)
    : null;

  if (restaurantId && restaurantFlag && restaurantFlag.enabled === false) {
    return false;
  }

  const globalFlag = await fetchFeatureFlag(featureKey, null);
  return globalFlag.enabled !== false;
}

export const requireFeatureFlag = (featureKey, message) => async (req, res, next) => {
  try {
    const restaurantId =
      req.restaurantId ||
      req.user?.restaurantId ||
      req.headers['x-restaurant-id'] ||
      req.query?.restaurantId ||
      req.body?.restaurantId ||
      null;

    const enabled = await getEffectiveFeatureFlag(featureKey, restaurantId);
    logger.info('Feature flag check', {
      featureKey,
      restaurantId,
      enabled,
      userRole: req.user?.role || 'public',
      path: req.path,
    });

    if (!enabled) {
      return sendError(res, 403, message || `${featureKey} is currently disabled.`);
    }

    return next();
  } catch (error) {
    logger.error('Feature flag enforcement error:', {
      featureKey,
      message: error.message,
      path: req.path,
    });
    return sendError(res, 500, 'Feature flag validation failed');
  }
};

export default {
  getEffectiveFeatureFlag,
  requireFeatureFlag,
  clearFeatureFlagCache,
};
