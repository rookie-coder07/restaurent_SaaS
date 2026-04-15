import { logWarn } from '../utils/logger.js';
import SecurityAuditLogger from '../utils/securityAudit.js';

const normalizeOrigin = (origin = '') => String(origin || '').trim().replace(/\/+$/, '').toLowerCase();

const isAllowedWildcardOrigin = (origin = '') => {
  const normalizedOrigin = normalizeOrigin(origin);
  return (
    /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(normalizedOrigin) ||
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizedOrigin)
  );
};

const isAllowedDevelopmentOrigin = (origin = '') => {
  const normalizedOrigin = normalizeOrigin(origin);
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizedOrigin);
};

export const secureHeadersMiddleware = (req, res, next) => {
  const isProduction = process.env.NODE_ENV === 'production';

  // Prevent clickjacking attacks
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME sniffing attacks
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Prevent referrer leak
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Strict Content Security Policy - Prevents inline scripts and external resource injection
  const csp = isProduction
    ? "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    : "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'";
  res.setHeader('Content-Security-Policy', csp);

  // Force HTTPS in production
  if (isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Disable dangerous browser features
  res.setHeader(
    'Permissions-Policy',
    'accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), camera=(), document-domain=(), encrypted-media=(), fullscreen=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), sync-xhr=(), usb=(), vr=(), xr-spatial-tracking=()'
  );

  // X-DNS-Prefetch-Control - Disable DNS prefetch
  res.setHeader('X-DNS-Prefetch-Control', 'off');

  // X-Download-Options - Prevent IE from downloading attachments
  res.setHeader('X-Download-Options', 'noopen');

  // Disable feature policy for sensitive APIs
  res.setHeader('Feature-Policy', 'geolocation \'none\'; microphone \'none\'; camera \'none\'; payment \'none\'');

  next();
};

export const corsConfiguration = () => {
  const corsOriginEnv = process.env.CORS_ORIGIN || '';
  const defaultOrigins = [
    'https://restaurent-saas.vercel.app',
    'https://restaurentsaas.vercel.app',
    'https://restaurentsaas-seven.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
  ];

  const envOrigins = corsOriginEnv
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const allowedOrigins = Array.from(new Set([
    ...defaultOrigins,
    ...envOrigins,
  ].map((origin) => normalizeOrigin(origin)).filter(Boolean)));
  
  return {
    origin: (origin, callback) => {
      const normalizedOrigin = normalizeOrigin(origin);

      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) {
        return callback(null, true);
      }
      
      // Always allow localhost/127.0.0.1 (for development)
      if (isAllowedDevelopmentOrigin(normalizedOrigin)) {
        logWarn(`[CORS] ✓ Allowed localhost origin: ${normalizedOrigin}`);
        return callback(null, true);
      }
      
      // Check if origin is in allowed list
      if (allowedOrigins.includes(normalizedOrigin)) {
        logWarn(`[CORS] ✓ Allowed origin from list: ${normalizedOrigin}`);
        return callback(null, true);
      }
      
      // Check wildcard patterns (vercel.app)
      if (isAllowedWildcardOrigin(normalizedOrigin)) {
        logWarn(`[CORS] ✓ Allowed wildcard origin: ${normalizedOrigin}`);
        return callback(null, true);
      }
      
      // Reject unknown origins in production
      logWarn(`[CORS] ✗ Rejected origin: ${normalizedOrigin}`);
      return callback(new Error('CORS policy violation'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id', 'X-XSRF-Token', 'X-Restaurant-Id', 'Accept'],
    exposedHeaders: ['X-Request-Id', 'X-Response-Time', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Content-Length'],
    maxAge: 3600,
    optionsSuccessStatus: 200,
  };
};

// CORS validation removed - all origins now allowed
