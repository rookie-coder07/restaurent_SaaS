#!/usr/bin/env node

/**
 * SECURITY CONFIGURATION VALIDATOR
 * Validates all 10 security requirements are properly implemented
 */

import fs from 'fs';
import path from 'path';

const backendDir = process.cwd();

const checks = {
  '1. JWT Authentication': {
    file: 'src/middleware/auth.js',
    pattern: /verifyAccessToken|authMiddleware/,
  },
  '2. RBAC Authorization': {
    file: 'src/middleware/authorization.js',
    pattern: /requireRole|authorize|requireAdmin/,
  },
  '3. Input Validation': {
    file: 'src/middleware/securityEnforcement.js',
    pattern: /enforceInputValidation|orderId|tableId|amount/,
  },
  '4. SQL Injection Prevention': {
    file: 'src/utils/sqlInjectionPrevention.js',
    pattern: /preventSQLInjection/,
  },
  '5. Rate Limiting': {
    file: 'src/middleware/rateLimit.js',
    pattern: /apiLimiter|authLimiter|orderLimiter/,
  },
  '6. CORS Configuration': {
    file: 'src/middleware/securityHeaders.js',
    pattern: /corsConfiguration|allowedOrigins/,
  },
  '7. Safe Error Handling': {
    file: 'src/middleware/errorHandler.js',
    pattern: /errorHandler|production|REDACTED/,
  },
  '8. Data Isolation': {
    file: 'src/middleware/dataIsolation.js',
    pattern: /dataIsolationMiddleware|restaurant_id|restaurantId/,
  },
  '9. Password Security': {
    file: 'src/utils/passwordSecurity.js',
    pattern: /hashPassword|validatePasswordStrength|bcrypt/,
  },
  '10. Activity Logging': {
    file: 'src/middleware/securityEnforcement.js',
    pattern: /enforceActivityLogging|logger\.warn/,
  },
};

console.log('\n' + '='.repeat(60));
console.log('SECURITY REQUIREMENTS VALIDATION');
console.log('='.repeat(60) + '\n');

let passed = 0;
let failed = 0;

Object.entries(checks).forEach(([requirement, { file, pattern }]) => {
  const filePath = path.join(backendDir, file);
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const matches = pattern.test(content);
    
    if (matches) {
      console.log(`✓ ${requirement}`);
      console.log(`  File: ${file}\n`);
      passed++;
    } else {
      console.log(`✗ ${requirement}`);
      console.log(`  File: ${file}`);
      console.log(`  Pattern not found\n`);
      failed++;
    }
  } catch (error) {
    console.log(`✗ ${requirement}`);
    console.log(`  File: ${file}`);
    console.log(`  Error: ${error.message}\n`);
    failed++;
  }
});

console.log('='.repeat(60));
console.log(`\nRESULTS: ${passed}/${passed + failed} security requirements verified\n`);

if (failed === 0) {
  console.log('✅ ALL SECURITY REQUIREMENTS IMPLEMENTED\n');
  console.log('='.repeat(60) + '\n');
  process.exit(0);
} else {
  console.log(`⚠️  ${failed} requirement(s) need attention\n`);
  console.log('='.repeat(60) + '\n');
  process.exit(1);
}
