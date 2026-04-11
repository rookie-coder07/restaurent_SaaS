# SECURITY MIGRATION - TESTING GUIDE

## How to Test the Security Implementation

### ✅ Automated Tests

#### 1. Run Security Verification Tests

```bash
# Linux/Mac
bash test-security.sh

# Windows PowerShell
powershell -ExecutionPolicy Bypass -File test-security.ps1

# Or use npm script (add to package.json)
npm run test:security
```

#### 2. Run Jest Unit Tests

```bash
# All tests
npm test

# Security tests only
npm test -- tests/security.routes.test.js

# Watch mode
npm test -- --watch

# Coverage report
npm test -- --coverage
```

#### 3. Run All Backend Tests

```bash
npm run test:all
```

---

## 🧪 Manual Testing Guide

### Test 1: Authentication & Password Validation

#### Weak Password Registration (SHOULD FAIL)
```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantName": "Test",
    "email": "test@example.com",
    "password": "123"
  }'

# Expected: 400 Bad Request
# Response: { "success": false, "errors": ["Password must be..."] }
```

#### Strong Password Registration (SHOULD SUCCEED)
```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantName": "Test",
    "email": "test@example.com",
    "password": "SecurePassword123!@#"
  }'

# Expected: 200-201 Success
# Response: { "success": true, "token": "..." }
```

#### Login Attempt (SHOULD LOG)
```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePassword123!@#"
  }'

# Check logs for: "LOGIN_ATTEMPT: email=test@example.com, success=true"
```

---

### Test 2: Input Validation

#### Invalid Menu Price - NEGATIVE (SHOULD FAIL)
```bash
TOKEN="your-jwt-token-here"

curl -X POST http://localhost:5000/api/v1/menu/items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Pizza",
    "price": -100,
    "categoryId": "cat-123"
  }'

# Expected: 400 Bad Request
# Response: { "success": false, "message": "Invalid menu item price" }
```

#### Valid Menu Price (SHOULD SUCCEED)
```bash
curl -X POST http://localhost:5000/api/v1/menu/items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Pizza",
    "price": 499.99,
    "categoryId": "cat-123"
  }'

# Expected: 200-201 Success
```

#### Invalid Discount Amount (SHOULD FAIL)
```bash
curl -X POST http://localhost:5000/api/v1/orders/order-123/discount-approval \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "discountAmount": 150
  }'

# Expected: 400 Bad Request
# Response: { "success": false, "message": "Invalid discount amount" }
```

---

### Test 3: Authorization Enforcement

#### Unauthorized Access (NO TOKEN - SHOULD FAIL)
```bash
curl -X GET http://localhost:5000/api/v1/orders

# Expected: 401 Unauthorized
# Response: { "message": "Authentication required" }
```

#### Invalid Token (SHOULD FAIL)
```bash
curl -X GET http://localhost:5000/api/v1/orders \
  -H "Authorization: Bearer invalid-token-xyz"

# Expected: 401 Unauthorized
```

#### Valid Token but Wrong Role (SHOULD FAIL)
```bash
# Use a waiter token trying to access admin route
curl -X DELETE http://localhost:5000/api/v1/developer/users/user-123 \
  -H "Authorization: Bearer waiter-token"

# Expected: 403 Forbidden
# Response: { "message": "Insufficient permissions" }
```

---

### Test 4: Critical Operation Logging

#### Check Settlement Logging (SHOULD LOG)
```bash
# Settle an order
curl -X POST http://localhost:5000/api/v1/orders/order-123/settle \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 500,
    "paymentMethod": "cash"
  }'

# Then check logs for: "CRITICAL_OPERATION: operation=order_settlement, orderId=order-123, amount=500, userId=..."
```

#### Check Deletion Logging (SHOULD LOG)
```bash
# Delete a menu item
curl -X DELETE http://localhost:5000/api/v1/menu/items/item-123 \
  -H "Authorization: Bearer $TOKEN"

# Check logs for: "CRITICAL_OPERATION: operation=menu_item_deletion, itemId=item-123, userId=..."
```

#### Check Staff Operation Logging (SHOULD LOG)
```bash
# Create staff member
curl -X POST http://localhost:5000/api/v1/restaurant/staff \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "waiter@example.com",
    "role": "waiter",
    "name": "Waiter"
  }'

# Check logs for: "CRITICAL_OPERATION: operation=staff_created, email=waiter@example.com, role=waiter"
```

---

### Test 5: Data Access Logging

#### Check Data Access Logging (SHOULD LOG)
```bash
# Get staff list
curl -X GET http://localhost:5000/api/v1/activity/staff \
  -H "Authorization: Bearer $TOKEN"

# Check logs for: "DATA_ACCESS: userId=..., resource=staff, action=list_view"
```

#### Check Analytics Logging (SHOULD LOG)
```bash
# Get analytics dashboard
curl -X GET http://localhost:5000/api/v1/analytics/dashboard \
  -H "Authorization: Bearer $TOKEN"

# Check logs for: "DATA_ACCESS: userId=..., resource=analytics_dashboard, action=view"
```

---

### Test 6: Suspicious Activity Detection

#### Detect Invalid Price (SHOULD LOG SUSPICIOUS)
```bash
curl -X POST http://localhost:5000/api/v1/menu/items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Expensive",
    "price": 9999999,
    "categoryId": "cat-123"
  }'

# Expected: 400 Bad Request
# Check logs for: "SUSPICIOUS_ACTIVITY: activity=invalid_menu_price, price=9999999"
```

#### Detect Invalid Discount (SHOULD LOG SUSPICIOUS)
```bash
curl -X POST http://localhost:5000/api/v1/orders/order-123/discount-approval \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "discountAmount": 200
  }'

# Expected: 400 Bad Request
# Check logs for: "SUSPICIOUS_ACTIVITY: activity=invalid_discount_attempt, discountAmount=200"
```

---

### Test 7: Data Isolation

#### Customer Order - Invalid Table (SHOULD FAIL)
```bash
curl -X POST http://localhost:5000/api/v1/customer/orders \
  -H "Content-Type: application/json" \
  -d '{
    "tableNumber": "INVALID",
    "items": [{"id": "item-1", "quantity": 1}],
    "amount": 100
  }'

# Expected: 400 or 404
# Check logs for: "FAILED_VALIDATION: field=table_number, reason=Table not found"
```

#### Customer Order - Empty Items (SHOULD FAIL)
```bash
curl -X POST http://localhost:5000/api/v1/customer/orders \
  -H "Content-Type: application/json" \
  -d '{
    "tableNumber": "A1",
    "items": [],
    "amount": 100
  }'

# Expected: 400
# Check logs for: "FAILED_VALIDATION: field=items, reason=Invalid or empty items array"
```

---

### Test 8: SQL Injection Prevention

#### Attempt SQL Injection (SHOULD BE BLOCKED)
```bash
# In order ID parameter
curl -X GET "http://localhost:5000/api/v1/orders/1' OR '1'='1" \
  -H "Authorization: Bearer $TOKEN"

# Expected: 400 Bad Request
# Check logs for: "SQL_INJECTION_ATTEMPT: input=1' OR '1'='1"
```

#### Attempt XSS Attack (SHOULD BE BLOCKED)
```bash
curl -X POST http://localhost:5000/api/v1/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "<script>alert(1)</script>",
    "tableId": "table-1"
  }'

# Expected: 400 Bad Request
# Check logs for: "XSS_ATTEMPT: input contains script tags"
```

---

### Test 9: Rate Limiting

#### Exceed Rate Limit (SHOULD BE LIMITED)
```bash
# Try to login 10+ times in 5 minutes
for i in {1..15}; do
  curl -X POST http://localhost:5000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "email": "test@example.com",
      "password": "wrong"
    }'
  sleep 1
done

# After limit exceeded:
# Expected: 429 Too Many Requests
# Response: { "message": "Too many login attempts, please try again later" }
```

---

### Test 10: Error Safety (No Stack Traces)

#### Trigger Error on Protected Endpoint
```bash
curl -X GET http://localhost:5000/api/v1/orders/invalid \
  -H "Authorization: Bearer $TOKEN"

# Response should NOT contain:
# - "at Function"
# - "at Object"
# - File paths
# - Error stack

# Response SHOULD contain:
# - Generic message: "Failed to fetch order"
# - No technical details
```

---

## 📊 Viewing Logs

### Check Security Logs
```bash
# Windows PowerShell
Get-Content logs/security.log -Tail 50

# Linux/Mac
tail -50 logs/security.log

# Real-time logs (follow)
tail -f logs/security.log
```

### Search for Specific Events
```bash
# Login attempts
grep "LOGIN_ATTEMPT" logs/security.log

# Critical operations
grep "CRITICAL_OPERATION" logs/security.log

# Suspicious activity
grep "SUSPICIOUS_ACTIVITY" logs/security.log

# Failed validations
grep "FAILED_VALIDATION" logs/security.log

# Injection attempts
grep "SQL_INJECTION_ATTEMPT\|XSS_ATTEMPT" logs/security.log

# Unauthorized access
grep "UNAUTHORIZED_ACCESS" logs/security.log
```

---

## 🔍 Testing Checklist

- [ ] User registration rejects weak passwords
- [ ] User registration accepts strong passwords  
- [ ] Login attempts are logged
- [ ] Password changes require strong passwords
- [ ] Menu item prices validated (no negatives)
- [ ] Menu item prices validated (max limit)
- [ ] Order discounts validated (0-100%)
- [ ] Unauthenticated requests rejected (401)
- [ ] Low-permission users cannot access admin routes (403)
- [ ] Order settlements logged as critical operations
- [ ] Order deletions logged as critical operations
- [ ] Menu deletions logged as critical operations
- [ ] Staff operations logged as critical operations
- [ ] Admin operations logged as critical operations
- [ ] Data access is logged
- [ ] Suspicious prices logged
- [ ] Suspicious discounts logged
- [ ] Invalid table addresses logged
- [ ] SQL injection attempts blocked
- [ ] XSS injection attempts blocked
- [ ] Rate limiting enforced
- [ ] Errors don't leak stack traces
- [ ] Error messages are generic
- [ ] All 12 route files have SecurityAuditLogger
- [ ] All security utilities exist
- [ ] app.js has all middleware integrated

---

## 🚀 Integration Testing

### Full Flow Test
```bash
# 1. Register
TOKEN=$(curl -s -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantName": "Test Restaurant",
    "email": "test@example.com",
    "password": "SecurePassword123!@#"
  }' | jq -r '.token')

echo "Registered: $TOKEN"

# 2. Create menu item
curl -X POST http://localhost:5000/api/v1/menu/items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Burger",
    "price": 299.99,
    "categoryId": "sandwiches"
  }'

# 3. Create order
curl -X POST http://localhost:5000/api/v1/customer/orders \
  -H "Content-Type: application/json" \
  -d '{
    "tableNumber": "1",
    "items": [{"id": "item-1", "quantity": 1}],
    "amount": 299.99
  }'

# 4. Check logs
tail -100 logs/security.log
```

---

## 📈 Expected Log Output

### Successful Login
```
2026-04-10T10:30:45.123Z [SECURITY] LOGIN_ATTEMPT: 
  email=test@example.com
  success=true
  ip=127.0.0.1
  timestamp=2026-04-10T10:30:45.123Z
```

### Failed Strong Password
```
2026-04-10T10:31:12.456Z [SECURITY] FAILED_VALIDATION:
  userId=unknown
  field=password
  reason=Password does not meet security requirements: 
    - Minimum 8 characters required
    - Special character required (!@#$%^&*)
  ip=127.0.0.1
```

### Critical Operation
```
2026-04-10T10:35:20.789Z [SECURITY] CRITICAL_OPERATION:
  operation=order_settlement
  orderId=order-abc123
  amount=500
  userId=user-123
  restaurantId=rest-456
  ip=127.0.0.1
  timestamp=2026-04-10T10:35:20.789Z
```

---

## ❌ Troubleshooting

### Tests Fail - SecurityAuditLogger Not Found
**Problem:** "Cannot find module 'securityAudit.js'"
```bash
# Check file exists
ls -la src/utils/securityAudit.js

# Check export
grep "export" src/utils/securityAudit.js

# Fix if needed
npm install
npm run build
```

### Logs Not Appearing
**Problem:** No logs in `logs/security.log`
```bash
# Check log directory exists
mkdir -p logs

# Check winston logger initialized
grep -i "winston\|logger" src/utils/logger.js

# Verify SecurityAuditLogger uses logger
grep "logger" src/utils/securityAudit.js
```

### Rate Limiting Too Strict
**Problem:** Getting 429 on legitimate requests
```bash
# Check rate limiter config
cat src/middleware/rateLimiter.js

# Increase limits if needed
# DEFAULT: 100 req/minute per IP, 5 req/5min per user
```

### Tests Timeout
**Problem:** Jest tests timing out
```bash
# Increase timeout in jest.config.cjs
# testTimeout: 30000 (30 seconds)

# Run with more time
npm test -- --testTimeout=60000
```

---

## Next Steps

1. ✅ **Run automated tests:** `bash test-security.sh`
2. ✅ **Run manual tests:** Follow test scenarios above
3. ✅ **Review logs:** Check `logs/security.log` for proper entries
4. ✅ **Deploy to staging:** Test full flow in staging environment
5. ✅ **Monitor in production:** Watch logs for 72 hours
6. ✅ **Adjust thresholds:** Fine-tune rate limits and alert sensitivity

---

## Support

For issues or questions:
1. Check logs in `logs/security.log`
2. Review security documentation in backend folder
3. Run `bash test-security.sh` to verify setup
4. Check migration guide: `ENDPOINT_MIGRATION_GUIDE.md`
