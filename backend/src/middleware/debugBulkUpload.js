/**
 * Enhanced Debug Middleware for Bulk Upload
 * Logs each step of the middleware chain
 */

export const debugBulkUploadMiddleware = (req, res, next) => {
  // Log entry to middleware chain
  console.log('\n' + '='.repeat(80));
  console.log('[DEBUG] BULK UPLOAD MIDDLEWARE CHAIN');
  console.log('='.repeat(80));

  const startTime = Date.now();

  // Step 1: Request details
  console.log('[DEBUG] 1. REQUEST DETAILS:');
  console.log('  - Method:', req.method);
  console.log('  - URL:', req.originalUrl);
  console.log('  - Path:', req.path);
  console.log('  - IP:', req.ip);

  // Step 2: Authorization header
  console.log('[DEBUG] 2. AUTHORIZATION:');
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    console.log('  - Header present: YES');
    console.log('  - Token length:', token.length);
    console.log('  - Token preview:', token.substring(0, 30) + '...');
    
    // Try to decode JWT payload
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        console.log('  - Token payload:');
        console.log('    - userId:', payload.userId || payload.sub);
        console.log('    - email:', payload.email);
        console.log('    - role:', payload.role);
        console.log('    - restaurantId:', payload.restaurantId);
        console.log('    - expiresAt:', new Date(payload.exp * 1000).toISOString());
        const now = Date.now() / 1000;
        if (payload.exp < now) {
          console.log('    - ⚠ WARNING: Token is EXPIRED');
        }
      }
    } catch (e) {
      console.log('  - Could not decode token');
    }
  } else {
    console.log('  - Header present: NO ❌');
  }

  // Step 3: User context (set by authMiddleware)
  console.log('[DEBUG] 3. USER CONTEXT (after authMiddleware):');
  if (req.user) {
    console.log('  - User ID:', req.user.userId);
    console.log('  - Email:', req.user.email);
    console.log('  - Role:', req.user.role);
    console.log('  - Permissions:', req.user.permissions);
  } else {
    console.log('  - User: NOT SET ❌ (authMiddleware may have failed)');
  }

  // Step 4: Restaurant context (set by tenantIsolation)
  console.log('[DEBUG] 4. RESTAURANT CONTEXT (after tenantIsolation):');
  if (req.restaurantId) {
    console.log('  - Restaurant ID:', req.restaurantId);
  } else {
    console.log('  - Restaurant ID: NOT SET ❌ (tenantIsolation may have failed)');
  }

  // Step 5: File information (at multer middleware)
  console.log('[DEBUG] 5. FILE INFORMATION:');
  if (req.file) {
    console.log('  - File received: YES ✓');
    console.log('  - Filename:', req.file.originalname);
    console.log('  - MIME type:', req.file.mimetype);
    console.log('  - File size:', req.file.size, 'bytes');
    console.log('  - Buffer length:', req.file.buffer?.length || 0, 'bytes');
    console.log('  - Encoding:', req.file.encoding);
    console.log('  - Field name:', req.file.fieldname);
    
    // Preview first 100 chars
    if (req.file.buffer && req.file.buffer.length > 0) {
      const preview = req.file.buffer.toString().substring(0, 100);
      console.log('  - Buffer preview:', preview.replace(/\n/g, '\\n'));
    }
  } else {
    console.log('  - File received: NO ❌ (multer may not have received file)');
    console.log('  - Available fields:', Object.keys(req.body || {}));
    console.log('  - Available files:', Object.keys(req.files || {}));
  }

  // Step 6: Headers summary
  console.log('[DEBUG] 6. REQUEST HEADERS:');
  const headersToLog = [
    'content-type',
    'authorization',
    'x-restaurant-id',
    'x-requested-with',
    'origin',
  ];
  headersToLog.forEach(header => {
    const value = req.headers[header];
    console.log(`  - ${header}:`, value ? 'SET' : 'NOT SET');
  });

  // Add timing tracker to res
  const originalSend = res.send;
  res.send = function (data) {
    const duration = Date.now() - startTime;
    console.log('\n[DEBUG] MIDDLEWARE EXECUTION:');
    console.log('  - Duration:', duration, 'ms');
    console.log('  - Response status:', res.statusCode);
    
    if (res.statusCode >= 400) {
      console.log('  - ⚠ ERROR RESPONSE');
      try {
        const parsed = JSON.parse(data);
        console.log('  - Error message:', parsed.message || parsed.error);
      } catch (e) {
        console.log('  - Response:', data.toString().substring(0, 200));
      }
    } else {
      console.log('  - ✓ SUCCESS RESPONSE');
    }
    console.log('='.repeat(80) + '\n');

    // Call original send
    return originalSend.call(this, data);
  };

  next();
};

/**
 * Log details at each authorization step
 */
export const debugAuthSteps = {
  // After authMiddleware
  afterAuth: (req, res, next) => {
    console.log('[DEBUG] AFTER authMiddleware:');
    console.log('  - req.user:', req.user ? '✓' : '✗');
    console.log('  - req.user.userId:', req.user?.userId);
    console.log('  - req.user.role:', req.user?.role);
    next();
  },

  // After tenantIsolation
  afterTenant: (req, res, next) => {
    console.log('[DEBUG] AFTER tenantIsolation:');
    console.log('  - req.restaurantId:', req.restaurantId || '✗');
    next();
  },

  // After requireRole
  afterRole: (req, res, next) => {
    console.log('[DEBUG] AFTER requireRole:');
    console.log('  - User role:', req.user?.role);
    console.log('  - Required roles: [owner]');
    console.log('  - Role check passed: ✓');
    next();
  },

  // After checkPermission
  afterPermission: (req, res, next) => {
    console.log('[DEBUG] AFTER checkPermission:');
    console.log('  - User permissions:', req.user?.permissions);
    console.log('  - Required permission: create_menu');
    console.log('  - Permission check passed: ✓');
    next();
  },

  // At multer
  atMulter: (req, res, next) => {
    console.log('[DEBUG] AT multer middleware:');
    if (req.file) {
      console.log('  - File received: ✓');
      console.log('  - Filename:', req.file.originalname);
      console.log('  - Size:', req.file.size);
    } else {
      console.log('  - File received: ✗');
    }
    next();
  },
};

export default debugBulkUploadMiddleware;
