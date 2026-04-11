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
  const isProduction = process.env.NODE_ENV === 'production';
  const allowedOrigins = isProduction
    ? (process.env.ALLOWED_ORIGINS || 'https://restaurent-saas.vercel.app').split(',')
    : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174'];

  return {
    origin: function(origin, callback) {
      // Allow requests without origin (e.g., curl, mobile, same-site)
      if (!origin) {
        return callback(null, true);
      }

      // Validate origin against whitelist
      const isAllowed = allowedOrigins.some(allowed => {
        // Exact match
        if (allowed === origin) return true;
        
        // Wildcard domain match (e.g., *.vercel.app)
        if (allowed.startsWith('*.')) {
          const domain = allowed.substring(2);
          return origin.endsWith(domain) || origin === `https://${domain}`;
        }
        
        return false;
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        logWarn('CORS request blocked', {
          origin,
          allowedOrigins,
          timestamp: new Date().toISOString(),
        });

        SecurityAuditLogger.logCrossOriginRequest(origin, 'unknown', false, 'CORS');
        callback(new Error('Not allowed by CORS policy'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id', 'X-XSRF-Token', 'X-Restaurant-Id'],
    exposedHeaders: ['X-Request-Id', 'X-Response-Time', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 3600,
    optionsSuccessStatus: 200,
  };
};

export const validateOrigin = (origin, allowedOrigins) => {
  if (!origin) {
    return true; // Allow requests without origin (e.g., curl, mobile)
  }

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  // Check for wildcard domains
  for (const allowed of allowedOrigins) {
    if (allowed.startsWith('*.') && origin.endsWith(allowed.substring(1))) {
      return true;
    }
  }

  return false;
};
