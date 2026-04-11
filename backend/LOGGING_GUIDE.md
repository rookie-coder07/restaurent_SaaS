/**
 * Comprehensive Backend Logging Guide
 * 
 * This document explains the structured logging system implemented across the POS SaaS backend.
 */

## Overview

The backend now includes comprehensive structured logging across all major operations:
- **Error tracking** with context and stack traces
- **Failed request logging** for validation errors
- **Critical action logging** for important business operations
- **Request performance tracking** for detecting slow operations
- **Automatic error propagation** without crashing the app

## Log Files

All logs are written to the `logs/` directory:
- `logs/error.log` - All errors and warnings (5MB max, 5 files retained)
- `logs/app.log` - All application logs including info (5MB max, 5 files retained)

## Structured Logging Format

### Error Logging
```javascript
logError(error, {
  message: "Error description",
  endpoint: "/api/endpoint",
  method: "POST",
  userId: "user123",
  restaurantId: "rest456",
  orderId: "order789",
  tableId: "table10",
  statusCode: 500,
  action: "create_order"
});
```

### Failed Request Logging
```javascript
logFailedRequest(error, {
  message: "Request validation failed",
  endpoint: "/api/endpoint",
  method: "POST",
  userId: "user123",
  restaurantId: "rest456",
  statusCode: 400,
  action: "create_order_validation"
});
```

### Critical Action Logging
```javascript
logCriticalAction("order_created", {
  message: "New order created",
  userId: "user123",
  restaurantId: "rest456",
  orderId: "order789",
  tableId: "table10",
  severity: "critical", // or "warning" or "info"
  details: {
    itemCount: 5,
    totalAmount: 2500,
    orderType: "dine-in"
  }
});
```

### Successful Operation Logging
```javascript
logSuccessfulOperation("get_orders", {
  message: "Orders retrieved successfully",
  endpoint: "/api/endpoint",
  method: "GET",
  userId: "user123",
  restaurantId: "rest456",
  duration: 45,
  details: { orderCount: 10 }
});
```

## Controllers with Enhanced Logging

### ✅ Order Controller (`src/controllers/orderController.js`)
- ✅ createOrder - logs new orders with item count
- ✅ getOrders - logs retrieval with filter details
- ✅ getActiveOrders - tracks active order fetches
- ✅ getOpenBills - monitors open bill queries
- ✅ updateOrderStatus - logs status changes
- ✅ settleOrder - critical action logging for payments
- ✅ sendOrderToKitchen - tracks kitchen submissions
- ✅ markOrderPaid - logs payment confirmations

### ✅ Table Controller (`src/controllers/tableController.js`)
- ✅ createTable - logs new table creation
- ✅ updateTable - tracks table modifications
- ✅ deleteTable - critical action for table deletion
- ✅ Error handling for all operations

### ✅ Authentication Controller (`src/controllers/authController.js`)
- ✅ loginRestaurant - logs restaurant logins with severity
- ✅ Validation error tracking
- ✅ Login failure detection

### ✅ Kitchen Controller (`src/controllers/kitchenController.js`)
- ✅ getKitchenOrders - tracks kitchen display refreshes
- ✅ updateKitchenTicketStatus - logs ticket status changes
- ✅ reprintKitchenTicket - tracks reprints

## Global Error Handling

All endpoints are wrapped with `asyncHandler` which automatically:
1. ✅ Catches unhandled errors
2. ✅ Prevents app crashes
3. ✅ Passes errors to error handler middleware
4. ✅ Logs errors with context
5. ✅ Returns appropriate HTTP status codes

Example:
```javascript
export const createOrder = asyncHandler(async (req, res) => {
  try {
    // ... operation code ...
    logCriticalAction('order_created', { /* context */ });
    return sendSuccess(res, 201, data, 'Order created');
  } catch (error) {
    logError(error, { /* context */ });
    throw error; // asyncHandler catches and passes to errorHandler
  }
});
```

## Request Logging Middleware

Located in `src/app.js`:

1. **Request Logger** - Logs all incoming requests
   - Method, path, origin, IP address
   - Response status code on completion

2. **Structured Logging Middleware** - Tracks performance
   - Detects slow requests (>1s)
   - Logs warnings for errors or slowness

3. **Performance Middleware** - Measures endpoint performance
   - Response times for optimization
   - Slow query detection

## What Gets Logged

### Every API Request:
- Method (GET, POST, PUT, PATCH, DELETE)
- Endpoint path
- Request origin
- Client IP address
- Response status code

### Every Error:
- Error message
- Stack trace
- Endpoint
- User ID
- Restaurant ID
- Related IDs (orderId, tableId, etc.)
- Action being performed
- HTTP status code

### Every Critical Action:
- Order creation/settlement
- Table operations
- User authentication
- Payment processing
- Kitchen ticket updates
- Staff activity

### Performance Issues:
- Requests > 1 second
- Slow database queries (>500ms)
- Cache hit/miss rates

## Debugging Production Issues

### Find errors in logs:
```bash
# Search for errors in error.log
grep "action.*create_order" logs/error.log

# Find errors for specific order
grep "orderId.*12345" logs/error.log

# Find slow requests
grep "duration" logs/app.log | sort -t: -k4
```

### Track a user's activity:
```bash
# All activity for user ID
grep "userId.*user123" logs/app.log

# Failed requests by user
grep "userId.*user123" logs/error.log
```

### Monitor restaurant activity:
```bash
# All activity for restaurant
grep "restaurantId.*rest456" logs/app.log

# Errors specific to restaurant
grep "restaurantId.*rest456" logs/error.log
```

## Error Prevention

The system prevents crashes by:

1. **Try-Catch Blocks** - Enclose all async operations
2. **asyncHandler Wrapper** - Catches uncaught errors
3. **Error Handler Middleware** - Global error fallback
4. **Structured Logging** - No silent failures
5. **User-Friendly Responses** - Always returns proper HTTP responses

Example safe flow:
```
Request → Validation → Try Block
                         ↓
                    Operation
                    (success or error)
                         ↓
                    Logging
                    (error details captured)
                         ↓
                    asyncHandler catches
                    passes to errorHandler
                         ↓
                    User receives
                    error response (never crash)
```

## Best Practices

1. **Always log critical actions**
   - Payment processing
   - Order placement
   - Table assignments
   - Authentication

2. **Include context in logs**
   - User ID
   - Restaurant ID
   - Related entity IDs
   - Action being performed

3. **Use appropriate log levels**
   - `logError` for failures
   - `logFailedRequest` for validation
   - `logCriticalAction` for business events
   - `logSuccessfulOperation` for tracking

4. **Wrap all async operations**
   - Use asyncHandler in controllers
   - Use try-catch in services
   - Always pass errors to next

5. **Never suppress errors**
   - All errors must be logged
   - All errors must be caught
   - Never let errors crash the app

## Testing Logs

To verify logging is working:

1. **Local Development**
   - Logs appear in console (development mode)
   - Logs written to file (all modes)

2. **Check Console Output**
   ```bash
   # Watch logs in real time
   tail -f logs/error.log
   ```

3. **Generate Test Error**
   ```bash
   # POST without required fields
   curl -X POST http://localhost:3000/api/orders \
     -H "Content-Type: application/json"
   ```

4. **Check Logs**
   ```bash
   cat logs/error.log | tail -20
   ```

## Configuration

Logger level can be configured via environment variable:
```bash
LOG_LEVEL=debug npm start  # Very verbose
LOG_LEVEL=info npm start   # Normal
LOG_LEVEL=error npm start  # Only errors
```

Default: `info`

## Summary

✅ **Complete coverage** of all critical operations  
✅ **Structured format** for easy parsing and debugging  
✅ **No app crashes** - all errors caught and logged  
✅ **Easy to trace** issues with context-rich logs  
✅ **Production-ready** with rotation and file management  
✅ **Developer-friendly** with console output in development  

The backend is now fully instrumented for:
- Easy debugging
- Production issue tracking
- Performance monitoring
- User activity auditing
- Error investigation
