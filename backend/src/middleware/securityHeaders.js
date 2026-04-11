import { logWarn } from '../utils/logger.js';
import SecurityAuditLogger from '../utils/securityAudit.js';

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
  // CORS completely open - all origins allowed
  return {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id', 'X-XSRF-Token', 'X-Restaurant-Id'],
    exposedHeaders: ['X-Request-Id', 'X-Response-Time', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 3600,
    optionsSuccessStatus: 200,
  };
};

// CORS validation removed - all origins now allowed
