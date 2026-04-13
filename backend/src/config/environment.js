import logger from '../utils/logger.js';

const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'JWT_SECRET',
  'REFRESH_TOKEN_SECRET',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];

const parseNumber = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const inferNodeEnv = () => {
  const explicitNodeEnv = String(process.env.NODE_ENV || '').trim().toLowerCase();
  if (explicitNodeEnv) {
    return explicitNodeEnv;
  }

  if (process.env.RENDER || process.env.RENDER_EXTERNAL_URL) {
    return 'production';
  }

  return 'development';
};

const getResolvedBaseUrl = () => (
  process.env.BASE_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  'https://restaurent-backend-448t.onrender.com'
).replace(/\/+$/, '');

const parseCorsOrigins = (value) => {
  if (!value) {
    return ['https://restaurent-saas.vercel.app'];
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

export const validateEnvironment = () => {
  const missing = requiredEnvVars.filter((envVar) => !process.env[envVar]);

  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  if (!process.env.NODE_ENV && (process.env.RENDER || process.env.RENDER_EXTERNAL_URL)) {
    logger.warn('NODE_ENV not set explicitly; defaulting to production for Render runtime');
  }

  logger.info('All required environment variables are set');
};

export const getConfig = () => {
  const nodeEnv = inferNodeEnv();

  return {
    nodeEnv,
    isProd: nodeEnv === 'production',
    port: parseNumber(process.env.PORT || process.env.APP_PORT, 5000),
    baseUrl: getResolvedBaseUrl(),
    supabase: {
      url: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY,
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiry: process.env.JWT_EXPIRY || '15m',
    refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET,
    refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d',
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      apiSecret: process.env.CLOUDINARY_API_SECRET,
    },
    corsOrigins: parseCorsOrigins(process.env.CORS_ORIGIN),
    logLevel: process.env.LOG_LEVEL || 'info',
    logFile: process.env.LOG_FILE || 'logs/app.log',
    rateLimitWindowMs: parseNumber(process.env.RATE_LIMIT_WINDOW_MS, 900000),
    rateLimitMaxRequests: parseNumber(process.env.RATE_LIMIT_MAX_REQUESTS, 100),
    apiVersion: process.env.API_VERSION || 'v1',
  };
};
