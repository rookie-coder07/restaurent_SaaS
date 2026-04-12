#!/bin/bash

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Order Delete Permission Test${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

# You need to set these
API_BASE_URL="${API_BASE_URL:- restaurent-backend-448t.onrender.com}" # Change if needed
EMAIL="${EMAIL:-owner@restaurant.com}"
PASSWORD="${PASSWORD:-Owner123@456}"
PORTAL="${PORTAL:-admin}"

echo -e "${YELLOW}Configuration:${NC}"
echo "API Base URL: $API_BASE_URL"
echo "Email: $EMAIL"
echo "Portal: $PORTAL"
echo -e ""

# Step 1: Login
echo -e "${YELLOW}Step 1: Logging in...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "https://$API_BASE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\",
    \"portal\": \"$PORTAL\"
  }")

echo -e "Response: ${LOGIN_RESPONSE:0:200}...\n"

# Extract token
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
USER_ROLE=$(echo "$LOGIN_RESPONSE" | grep -o '"role":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Login failed!${NC}\n"
  echo "Full response: $LOGIN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Login successful!${NC}"
echo -e "Token: ${TOKEN:0:50}...[REDACTED]\n"
echo -e "Role: $USER_ROLE\n"

# Step 2: Test permission check directly
echo -e "${YELLOW}Step 2: Testing permission check (HEAD request to protected endpoint)...${NC}"
PERM_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "https://$API_BASE_URL/api/v1/orders/active" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo -e "HTTP Status: $PERM_RESPONSE"
if [ "$PERM_RESPONSE" = "200" ]; then
  echo -e "${GREEN}✅ Permission check passed!${NC}\n"
else
  echo -e "${RED}❌ Permission check failed with status $PERM_RESPONSE${NC}\n"
fi

# Step 3: Try to delete a (fake) order
echo -e "${YELLOW}Step 3: Testing order deletion endpoint...${NC}"
DELETE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "https://$API_BASE_URL/api/v1/orders/test-order-id-for-permission-test/delete" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Test deletion for permission check",
    "currentPassword": ""
  }')

# Split response body and status code
HTTP_BODY=$(echo "$DELETE_RESPONSE" | head -n -1)
HTTP_STATUS=$(echo "$DELETE_RESPONSE" | tail -n 1)

echo -e "HTTP Status: $HTTP_STATUS"
echo -e "Response Body: ${HTTP_BODY:0:500}...\n"

if [ "$HTTP_STATUS" = "403" ]; then
  echo -e "${RED}❌ Got 403 Forbidden - Permission denied!${NC}"
  echo "This indicates the checkPermission middleware is rejecting the request."
  echo "The user role likely isn't recognized as having 'manage_orders' permission."
  echo -e "\nFull error response:"
  echo "$HTTP_BODY" | jq '.' 2>/dev/null || echo "$HTTP_BODY"
elif [ "$HTTP_STATUS" = "400" ] || [ "$HTTP_STATUS" = "404" ]; then
  echo -e "${GREEN}✅ Got $HTTP_STATUS - Permission granted! (validation/not-found error is OK)${NC}"
  echo "This means the authorization check passed, but the order doesn't exist or validation failed."
  echo "The permission system is working correctly."
elif [ "$HTTP_STATUS" = "401" ]; then
  echo -e "${RED}❌ Got 401 Unauthorized - Invalid token!${NC}"
  echo "The authentication check failed. Token might be expired or invalid."
else
  echo -e "${YELLOW}⚠️  Got status $HTTP_STATUS${NC}"
fi

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Test Complete${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
