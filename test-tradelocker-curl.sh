#!/bin/bash

# TradeLocker API Test Script using curl
# Replace these variables with your actual credentials

EMAIL="your@email.com"
PASSWORD="yourpassword"
SERVER="TradeLocker-Live"  # Your actual server name
ENVIRONMENT="live"  # or "demo"
ACCOUNT_ID="692284"

BASE_URL="https://live.tradelocker.com/backend-api"
if [ "$ENVIRONMENT" = "demo" ]; then
  BASE_URL="https://demo.tradelocker.com/backend-api"
fi

echo "🔐 Step 1: Authenticating..."
echo "=================================="

# Authenticate and get token
AUTH_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/jwt/token" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${EMAIL}\",
    \"password\": \"${PASSWORD}\",
    \"server\": \"${SERVER}\"
  }")

echo "$AUTH_RESPONSE" | jq '.' 2>/dev/null || echo "$AUTH_RESPONSE"

# Extract access token (requires jq)
ACCESS_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.accessToken // .access_token // .token' 2>/dev/null)

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "null" ]; then
  echo "❌ Failed to get access token"
  exit 1
fi

echo ""
echo "✅ Authentication successful!"
echo "Token: ${ACCESS_TOKEN:0:50}..."
echo ""

echo "📋 Step 2: Fetching accounts..."
echo "=================================="

ACCOUNTS_RESPONSE=$(curl -s -X GET "${BASE_URL}/auth/jwt/all-accounts" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json")

echo "$ACCOUNTS_RESPONSE" | jq '.' 2>/dev/null || echo "$ACCOUNTS_RESPONSE"

# Extract accNum (requires jq)
ACC_NUM=$(echo "$ACCOUNTS_RESPONSE" | jq -r '.accounts[0].accNum // .accounts[0].accountNumber // 0' 2>/dev/null)

echo ""
echo "Account Number: $ACC_NUM"
echo ""

echo "💰 Step 3: Testing balance endpoints..."
echo "=================================="

# Test various balance endpoints
for endpoint in "info" "balance" "account" "summary" ""; do
  if [ -z "$endpoint" ]; then
    URL="${BASE_URL}/trade/accounts/${ACCOUNT_ID}"
  else
    URL="${BASE_URL}/trade/accounts/${ACCOUNT_ID}/${endpoint}"
  fi
  
  echo ""
  echo "Testing: $URL"
  
  RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X GET "$URL" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "accNum: ${ACC_NUM}" \
    -H "Content-Type: application/json")
  
  HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
  BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')
  
  if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Status: $HTTP_STATUS"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY" | head -20
  else
    echo "❌ Status: $HTTP_STATUS"
    echo "$BODY" | head -5
  fi
done

echo ""
echo "📊 Step 4: Fetching trade history..."
echo "=================================="

TRADES_URL="${BASE_URL}/trade/accounts/${ACCOUNT_ID}/ordersHistory"

echo "Testing: $TRADES_URL"

TRADES_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X GET "$TRADES_URL" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "accNum: ${ACC_NUM}" \
  -H "Content-Type: application/json")

HTTP_STATUS=$(echo "$TRADES_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$TRADES_RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ Status: $HTTP_STATUS"
  echo ""
  echo "Response structure:"
  echo "$BODY" | jq 'keys' 2>/dev/null || echo "Not JSON or jq not available"
  echo ""
  echo "Data structure:"
  echo "$BODY" | jq '.d | keys' 2>/dev/null || echo "$BODY" | jq 'keys' 2>/dev/null || echo "Not JSON"
  echo ""
  echo "Sample trade (first one):"
  echo "$BODY" | jq '.d.ordersHistory[0]' 2>/dev/null || echo "$BODY" | jq '.d[0]' 2>/dev/null || echo "$BODY" | head -50
else
  echo "❌ Status: $HTTP_STATUS"
  echo "$BODY" | head -10
fi
