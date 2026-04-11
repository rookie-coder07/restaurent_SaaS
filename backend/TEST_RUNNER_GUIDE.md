# QUICK SECURITY VERIFICATION
# Run this immediately to verify all security files are in place

## Windows PowerShell
```powershell
# Run security tests
powershell -ExecutionPolicy Bypass -File test-security.ps1

# Or with detailed output
powershell -ExecutionPolicy Bypass -File test-security.ps1 -Verbose
```

## Linux/Mac
```bash
# Run security tests
bash test-security.sh

# Or check specific routes
grep -l "SecurityAuditLogger" src/routes/*.js
```

## npm Commands (Add to package.json)

```json
{
  "scripts": {
    "test:security": "jest tests/security.routes.test.js",
    "test:all": "jest",
    "verify:security": "bash test-security.sh",
    "verify:security:windows": "powershell -ExecutionPolicy Bypass -File test-security.ps1"
  }
}
```

Then run:
```bash
npm run verify:security        # Linux/Mac
npm run verify:security:windows # Windows
```

---

## 🚀 Quick Start Testing

### 1. Verify File Structure (30 seconds)
```powershell
# Windows PowerShell
@(
  'src/utils/securityAudit.js',
  'src/utils/passwordSecurity.js',
  'src/utils/sqlInjectionPrevention.js',
  'src/middleware/securityHeaders.js',
  'src/middleware/authorization.js',
  'src/middleware/dataIsolation.js',
  'src/routes/auth.js',
  'src/routes/order.js',
  'src/routes/menu.js',
  'src/routes/table.js',
  'src/routes/restaurant.js',
  'src/routes/developer.js'
) | ForEach-Object {
  if (Test-Path $_) {
    Write-Host "✓ $_"
  } else {
    Write-Host "✗ $_ NOT FOUND"
  }
}
```

### 2. Check Security Imports (1 minute)
```powershell
# Verify all route files import SecurityAuditLogger
@(
  'src/routes/auth.js',
  'src/routes/order.js',
  'src/routes/menu.js',
  'src/routes/table.js',
  'src/routes/restaurant.js',
  'src/routes/developer.js',
  'src/routes/customer.js',
  'src/routes/inventory.js',
  'src/routes/activity.js',
  'src/routes/takeaway.js'
) | ForEach-Object {
  if (Select-String -Path $_ -Pattern "SecurityAuditLogger" -Quiet) {
    Write-Host "✓ $_ has SecurityAuditLogger"
  } else {
    Write-Host "✗ $_ missing SecurityAuditLogger"
  }
}
```

### 3. Run Full Test Suite (2 minutes)
```powershell
# Run PowerShell test script
powershell -ExecutionPolicy Bypass -File test-security.ps1
```

### 4. Start Server & Test Live (5 minutes)
```bash
# Terminal 1: Start server
npm run dev
# OR
node src/server.js

# Terminal 2: Run tests against live server
npm run test:security
# OR
jest tests/security.routes.test.js
```

---

## ✅ What Gets Tested

### File Structure Tests (12 files)
- ✓ All security utilities exist
- ✓ All security middleware exists
- ✓ All route files updated

### Code Integration Tests (60+ checks)
- ✓ All routes import SecurityAuditLogger
- ✓ Password validation on auth routes
- ✓ Critical operation logging
- ✓ Data access logging
- ✓ Suspicious activity detection
- ✓ Input validation
- ✓ Authorization checks
- ✓ App.js middleware integration

### Live Endpoint Tests (Optional)
- ✓ Weak password rejection
- ✓ Authentication enforcement
- ✓ Input validation
- ✓ Authorization enforcement

---

## 📊 Expected Test Results

### ✅ PASS: All Security Tests Passed
```
Total Tests: 75
Passed: 75 ✓
Failed: 0

✓ ALL SECURITY TESTS PASSED!
Ready for deployment!
```

### ❌ FAIL: Missing Files
```
✗ FAIL: File not found - src/utils/securityAudit.js

Check:
1. All files were created successfully
2. Navigate to correct directory
3. Check file permissions
```

---

## 🔍 Troubleshooting

### Issue: Tests timeout
```powershell
# Increase timeout
npm test -- --testTimeout=60000
```

### Issue: Module not found
```bash
npm install
npm run build
```

### Issue: Server not running for endpoint tests
```bash
# Start server in background
node src/server.js &

# Wait for startup
Start-Sleep -Seconds 3

# Run tests
npm run test:security
```

### Issue: Tests fail in CI/CD
```yaml
# Add to CI/CD pipeline
- name: Verify security implementation
  run: |
    bash test-security.sh  # Linux/Mac
    # OR
    powershell -ExecutionPolicy Bypass -File test-security.ps1  # Windows
  continue-on-error: false
```

---

## 📈 Next Steps After Testing

1. ✅ **Tests Pass Locally** → Commit and push
2. ✅ **Tests Pass in CI/CD** → Deploy to staging
3. ✅ **Staging Tests Pass** → Load test in staging
4. ✅ **Load Tests Pass** → Deploy to production
5. ✅ **Monitor Production** → Watch logs for 72 hours
6. ✅ **Adjust Thresholds** → Fine-tune based on real traffic

---

## Commands Reference

### Run All Tests
```bash
npm test
```

### Run Security Tests Only
```bash
npm run test:security
```

### Run Verification Script
```powershell
# Windows
powershell -ExecutionPolicy Bypass -File test-security.ps1

# Linux/Mac
bash test-security.sh
```

### Check Live Server
```bash
# With TOKEN set
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/v1/orders
```

### View Logs
```bash
# Real-time
tail -f logs/security.log

# Last 50 lines
tail -50 logs/security.log

# Search logs
grep "CRITICAL_OPERATION" logs/security.log
```

---

## 🎯 Success Criteria

- [ ] All 75+ static tests pass
- [ ] All route files have SecurityAuditLogger
- [ ] All security utilities exist
- [ ] App.js has all middleware
- [ ] Live endpoint tests pass (if server running)
- [ ] No stack traces in error responses
- [ ] Logs are being generated correctly
- [ ] Ready for production deployment

---

Run tests now: `npm run verify:security`
