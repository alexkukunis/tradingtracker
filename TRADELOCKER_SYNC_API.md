# TradeLocker Sync API Documentation

## Overview
This document describes the API request/response structure for syncing trades from TradeLocker when clicking "Sync Trades Now" in the Settings page.

## Request Flow

### 1. Frontend → Backend (Your Server)

**Endpoint:** `POST /api/tradelocker/sync`

**Headers:**
```json
{
  "Authorization": "Bearer <user_jwt_token>",
  "Content-Type": "application/json"
}
```

**Request Body:**
```json
{}
```
*(No body required - empty JSON object or no body at all)*

**Example Request:**
```javascript
// From src/services/api.js
tradelockerAPI.sync = async () => {
  return apiRequest('/api/tradelocker/sync', {
    method: 'POST'
    // No body sent
  })
}
```

---

### 2. Backend → TradeLocker API

**Endpoint:** `GET /trade/accounts/{accountId}/ordersHistory`

**Headers:**
```json
{
  "Authorization": "Bearer <tradelocker_access_token>",
  "accNum": "<account_number>",
  "Content-Type": "application/json"
}
```

**Query Parameters (Optional):**
```
?startTime=<ISO_date_string>&endTime=<ISO_date_string>
```
*(Currently not used - retrieves all trades)*

**Request Body:**
```
None (GET request)
```

**Example Request:**
```javascript
// From server/services/tradelocker.js
const response = await fetch(
  `${baseUrl}/trade/accounts/${accountId}/ordersHistory${qs}`, 
  {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'accNum': String(accNum),
      'Content-Type': 'application/json'
    }
  }
)
```

---

## Response Structure

### Backend Response to Frontend

**Success Response:**
```json
{
  "success": true,
  "message": "Synced 150 new trades from TradeLocker",
  "tradesCreated": 150,
  "accountBalance": 10000.50,
  "totalTrades": 150
}
```

**Error Response:**
```json
{
  "error": "TradeLocker account not connected"
}
```

---

### TradeLocker API Response

**Response Format (Array of Trades):**

The TradeLocker API returns trades in one of two formats:

#### Format 1: Array with Numeric Indices
```json
{
  "d": [
    {
      "0": "12345678",           // Order ID / Ticket
      "1": "instrument_id_123",  // Tradable Instrument ID
      "2": "position_id_456",    // Position ID
      "3": 0.1,                  // Volume
      "4": "buy",                // Type (buy/sell)
      "5": "market",             // Order Type
      "6": "filled",             // Status
      "8": 15000.50,             // Open Price
      "9": 15050.75,             // Close Price
      "10": 14950.00,            // Stop Price
      "12": 15100.00,            // Take Profit
      "13": 1704067200000,       // Open Time (milliseconds)
      "14": 1704070800000,       // Close Time (milliseconds)
      "19": 0.50,                // Swap
      "20": -1.00,               // Commission
      "21": 5.25                 // Profit (P&L)
    }
  ]
}
```

#### Format 2: Object with Named Fields
```json
{
  "d": {
    "ordersHistory": [
      {
        "orderId": "12345678",
        "positionId": "position_id_456",
        "tradableInstrumentId": "instrument_id_123",
        "volume": 0.1,
        "type": "buy",
        "orderType": "market",
        "status": "filled",
        "openPrice": 15000.50,
        "closePrice": 15050.75,
        "stopPrice": 14950.00,
        "takeProfit": 15100.00,
        "openTime": 1704067200000,
        "closeTime": 1704070800000,
        "swap": 0.50,
        "commission": -1.00,
        "realizedPnL": 5.25,
        "profit": 5.25
      }
    ]
  }
}
```

---

## Transformed Trade Data (Stored in Database)

After transformation, trades are stored with this structure:

```json
{
  "id": "cuid_string",
  "userId": "user_id",
  "date": "2024-01-01T12:00:00.000Z",
  "day": "Mon",
  "pnl": 5.25,
  "openBalance": 10000.00,
  "closeBalance": 10005.25,
  "percentGain": 0.0525,
  "riskDollar": 200.00,
  "targetDollar": 600.00,
  "rrAchieved": 0.02625,
  "targetHit": false,
  "notes": "NAS100 | Buy 0.1 Market | Entry: 15000.50 | Exit: 15050.75 | SL: 14950.00 | TP: 15100.00 | Fee: $-1.00 | Swap: $0.50 | Order: 12345678 | Position: position_id_456",
  "result": "Win",
  "tradelockerTradeId": "12345678",
  "createdAt": "2024-01-01T12:00:00.000Z",
  "updatedAt": "2024-01-01T12:00:00.000Z"
}
```

---

## Complete Request/Response Example

### Step 1: Frontend Request
```http
POST /api/tradelocker/sync HTTP/1.1
Host: localhost:3000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

### Step 2: Backend Request to TradeLocker
```http
GET /backend-api/trade/accounts/account_123/ordersHistory HTTP/1.1
Host: live.tradelocker.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
accNum: 123456
Content-Type: application/json
```

### Step 3: TradeLocker Response
```json
{
  "d": [
    {
      "0": "12345678",
      "1": "instrument_123",
      "2": "position_456",
      "3": 0.1,
      "4": "buy",
      "5": "market",
      "6": "filled",
      "8": 15000.50,
      "9": 15050.75,
      "10": 14950.00,
      "12": 15100.00,
      "13": 1704067200000,
      "14": 1704070800000,
      "19": 0.50,
      "20": -1.00,
      "21": 5.25
    }
  ]
}
```

### Step 4: Backend Response to Frontend
```json
{
  "success": true,
  "message": "Synced 1 new trades from TradeLocker",
  "tradesCreated": 1,
  "accountBalance": 10005.25,
  "totalTrades": 1
}
```

---

## Notes

1. **No JSON Payload Required**: The sync endpoint doesn't require any JSON body - it uses the authenticated user's stored TradeLocker credentials.

2. **GET Request to TradeLocker**: The backend makes a GET request to TradeLocker API (not POST), so there's no JSON body sent to TradeLocker.

3. **Date Filtering**: Currently, the sync retrieves ALL trades. To filter by date, you would add query parameters:
   ```
   ?startTime=2024-01-01T00:00:00Z&endTime=2024-12-31T23:59:59Z
   ```

4. **Authentication**: Both requests use Bearer token authentication:
   - Frontend → Backend: Uses user's JWT token
   - Backend → TradeLocker: Uses TradeLocker access token (stored in database)

5. **Trade Format**: TradeLocker returns trades in array format with numeric indices. The service normalizes this to a standard object format before storing in the database.
