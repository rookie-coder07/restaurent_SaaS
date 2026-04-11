#!/bin/bash

# SECURITY TESTING SUITE
# Comprehensive testing of all security migrations

echo "🔐 SECURITY TESTING SUITE - Starting"
echo "========================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
  local test_name=$1
  local test_cmd=$2
  
  echo -e "\n${YELLOW}Testing:${NC} $test_name"
  
  if eval "$test_cmd" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC}: $test_name"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗ FAIL${NC}: $test_name"
    ((TESTS_FAILED++))
  fi
  ((TESTS_RUN++))
}

# 1. Check all route files have SecurityAuditLogger imported
echo -e "\n${YELLOW}=== SECURITY IMPORTS CHECK ===${NC}"

run_test "auth.js has SecurityAuditLogger" \
  "grep -q 'SecurityAuditLogger' src/routes/auth.js"

run_test "order.js has SecurityAuditLogger" \
  "grep -q 'SecurityAuditLogger' src/routes/order.js"

run_test "menu.js has SecurityAuditLogger" \
  "grep -q 'SecurityAuditLogger' src/routes/menu.js"

run_test "table.js has SecurityAuditLogger" \
  "grep -q 'SecurityAuditLogger' src/routes/table.js"

run_test "developer.js has SecurityAuditLogger" \
  "grep -q 'SecurityAuditLogger' src/routes/developer.js"

run_test "restaurant.js has SecurityAuditLogger" \
  "grep -q 'SecurityAuditLogger' src/routes/restaurant.js"

run_test "customer.js has SecurityAuditLogger" \
  "grep -q 'SecurityAuditLogger' src/routes/customer.js"

run_test "inventory.js has SecurityAuditLogger" \
  "grep -q 'SecurityAuditLogger' src/routes/inventory.js"

run_test "activity.js has SecurityAuditLogger" \
  "grep -q 'SecurityAuditLogger' src/routes/activity.js"

run_test "takeaway.js has SecurityAuditLogger" \
  "grep -q 'SecurityAuditLogger' src/routes/takeaway.js"

# 2. Check for password validation imports
echo -e "\n${YELLOW}=== PASSWORD SECURITY CHECK ===${NC}"

run_test "auth.js has validatePasswordStrength" \
  "grep -q 'validatePasswordStrength' src/routes/auth.js"

run_test "passwordSecurity.js exists" \
  "test -f src/utils/passwordSecurity.js"

# 3. Check for validation middleware
echo -e "\n${YELLOW}=== INPUT VALIDATION CHECK ===${NC}"

run_test "order.js validates discount amounts" \
  "grep -q 'discountAmount.*>.*100' src/routes/order.js"

run_test "menu.js validates prices" \
  "grep -q 'price.*>' src/routes/menu.js"

run_test "customer.js validates table" \
  "grep -q 'tableId.*tableNumber' src/routes/customer.js"

# 4. Check for critical operation logging
echo -e "\n${YELLOW}=== CRITICAL OPERATION LOGGING CHECK ===${NC}"

run_test "order.js logs settlements" \
  "grep -q 'logCriticalOperation' src/routes/order.js && grep -q 'settle' src/routes/order.js"

run_test "order.js logs deletions" \
  "grep -q 'logCriticalOperation.*delete' src/routes/order.js"

run_test "menu.js logs deletions" \
  "grep -q 'logCriticalOperation.*delete' src/routes/menu.js"

run_test "restaurant.js logs staff operations" \
  "grep -q 'logCriticalOperation' src/routes/restaurant.js"

run_test "developer.js logs admin operations" \
  "grep -q 'logCriticalOperation' src/routes/developer.js"

# 5. Check data access logging
echo -e "\n${YELLOW}=== DATA ACCESS LOGGING CHECK ===${NC}"

run_test "activity.js logs data access" \
  "grep -q 'logDataAccess' src/routes/activity.js"

run_test "customer.js logs data access" \
  "grep -q 'logDataAccess' src/routes/customer.js"

run_test "inventory.js logs data access" \
  "grep -q 'logDataAccess' src/routes/inventory.js"

# 6. Check suspicious activity logging
echo -e "\n${YELLOW}=== SUSPICIOUS ACTIVITY DETECTION CHECK ===${NC}"

run_test "order.js detects invalid discounts" \
  "grep -q 'logSuspiciousActivity' src/routes/order.js"

run_test "menu.js detects invalid prices" \
  "grep -q 'logSuspiciousActivity' src/routes/menu.js"

run_test "customer.js detects suspicious orders" \
  "grep -q 'logSuspiciousActivity' src/routes/customer.js"

# 7. Check for authorization enforcement
echo -e "\n${YELLOW}=== AUTHORIZATION CHECK ===${NC}"

run_test "order.js uses requireBillingRole" \
  "grep -q 'requireBillingRole' src/routes/order.js"

run_test "menu.js uses requireRole" \
  "grep -q 'requireRole' src/routes/menu.js"

run_test "developer.js uses requireDeveloperAccess" \
  "grep -q 'requireDeveloperAccess' src/routes/developer.js"

run_test "restaurant.js uses checkPermission for staff" \
  "grep -q \"checkPermission.*'manage_staff'\" src/routes/restaurant.js"

# 8. Check security utilities exist
echo -e "\n${YELLOW}=== SECURITY UTILITIES CHECK ===${NC}"

run_test "securityAudit.js exists" \
  "test -f src/utils/securityAudit.js"

run_test "passwordSecurity.js exists" \
  "test -f src/utils/passwordSecurity.js"

run_test "sqlInjectionPrevention.js exists" \
  "test -f src/utils/sqlInjectionPrevention.js"

run_test "securityHeaders.js exists" \
  "test -f src/middleware/securityHeaders.js"

run_test "authorization.js exists" \
  "test -f src/middleware/authorization.js"

run_test "dataIsolation.js exists" \
  "test -f src/middleware/dataIsolation.js"

# 9. Check app.js integration
echo -e "\n${YELLOW}=== APP.JS INTEGRATION CHECK ===${NC}"

run_test "app.js has secureHeaders middleware" \
  "grep -q 'secureHeadersMiddleware' src/app.js"

run_test "app.js has preventSQLInjection middleware" \
  "grep -q 'preventSQLInjection' src/app.js"

run_test "app.js has preventXSS middleware" \
  "grep -q 'preventXSS' src/app.js"

run_test "app.js uses corsConfiguration" \
  "grep -q 'corsConfiguration' src/app.js"

# 10. Summary
echo -e "\n${YELLOW}=== TEST SUMMARY ===${NC}"
echo "Total Tests: $TESTS_RUN"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "\n${GREEN}✓ ALL SECURITY TESTS PASSED!${NC}"
  exit 0
else
  echo -e "\n${RED}✗ SOME TESTS FAILED - Please review above${NC}"
  exit 1
fi
