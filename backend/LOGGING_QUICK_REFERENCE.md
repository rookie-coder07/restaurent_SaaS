/**
 * QUICK REFERENCE: How to Add Logging to New Endpoints
 */

// ============ IMPORT AT TOP OF CONTROLLER ============
import { logError, logFailedRequest, logCriticalAction, logSuccessfulOperation } from '../utils/structuredLogging.js';

// ============ BASIC PATTERN ============
export const myEndpoint = asyncHandler(async (req, res) => {
  try {
    // Validate input
    if (!req.body.requiredField) {
      logFailedRequest(new Error('Missing required field'), {
        message: 'Validation failed',
        endpoint: req.path,
        method: req.method,
        userId: req.user?.id || req.user?.userId,
        restaurantId: req.restaurantId,
        statusCode: 400,
        action: 'my_action_validation',
      });
      return sendError(res, 400, 'Required field missing');
    }

    // Perform operation
    const result = await MyService.doSomething(req.body);

    // Log critical action if important
    logCriticalAction('my_action_performed', {
      message: 'Important action completed',
      userId: req.user?.id || req.user?.userId,
      restaurantId: req.restaurantId,
      orderId: result?.orderId,  // if applicable
      details: { fieldName: result?.value },
    });

    return sendSuccess(res, 200, result, 'Action completed successfully');
  } catch (error) {
    logError(error, {
      message: 'Failed to perform action',
      endpoint: req.path,
      method: req.method,
      userId: req.user?.id || req.user?.userId,
      restaurantId: req.restaurantId,
      statusCode: 500,
      action: 'my_action',
    });
    throw error; // asyncHandler will catch and error handler will process
  }
});

// ============ LOG ERROR ============
// Use when: Something went wrong, need to track the error
logError(error, {
  message: "Description of what failed",
  endpoint: req.path,           // "/api/orders"
  method: req.method,           // "POST"
  userId: req.user?.id,         // "user123"
  restaurantId: req.restaurantId, // "rest456"
  orderId: "order789",          // if applicable
  tableId: "table10",           // if applicable
  statusCode: 500,              // HTTP status
  action: "create_order"        // what was being done
});

// ============ LOG FAILED REQUEST ============
// Use when: User sent invalid data, validation failed
logFailedRequest(new Error('Invalid email format'), {
  message: "Description of validation failure",
  endpoint: req.path,
  method: req.method,
  userId: req.user?.id,
  restaurantId: req.restaurantId,
  statusCode: 400,              // Usually 400 for validation
  action: "create_order_validation"
});

// ============ LOG CRITICAL ACTION ============
// Use when: Important business operation (orders, payments, deletes)
logCriticalAction('order_created', {
  message: "What happened",
  userId: req.user?.id,
  restaurantId: req.restaurantId,
  orderId: order?.id,           // if applicable
  tableId: order?.tableId,      // if applicable
  severity: 'critical',         // or 'warning' or 'info'
  details: {
    itemCount: 5,
    totalAmount: 2500,
    orderType: 'dine-in'
  }
});

// ============ LOG SUCCESSFUL OPERATION ============
// Use when: Want to track successful operations (optional)
logSuccessfulOperation('get_orders', {
  message: "Retrieved orders successfully",
  endpoint: req.path,
  method: req.method,
  userId: req.user?.id,
  restaurantId: req.restaurantId,
  duration: 45,                 // milliseconds
  details: { orderCount: 10 }
});

// ============ REAL EXAMPLES ============

// --- Example 1: Create Operation ---
export const createMenuItem = asyncHandler(async (req, res) => {
  try {
    if (!req.body.name) {
      logFailedRequest(new Error('Name required'), {
        message: 'Create menu item validation failed',
        endpoint: req.path,
        method: req.method,
        userId: req.user?.id,
        restaurantId: req.restaurantId,
        statusCode: 400,
        action: 'create_menu_item_validation',
      });
      return sendError(res, 400, 'Menu item name is required');
    }

    const item = await MenuService.createItem(req.body);

    logCriticalAction('menu_item_created', {
      message: 'New menu item created',
      userId: req.user?.id,
      restaurantId: req.restaurantId,
      details: { itemName: item.name, price: item.price },
    });

    return sendSuccess(res, 201, item, 'Menu item created');
  } catch (error) {
    logError(error, {
      message: 'Failed to create menu item',
      endpoint: req.path,
      method: req.method,
      userId: req.user?.id,
      restaurantId: req.restaurantId,
      statusCode: 500,
      action: 'create_menu_item',
    });
    throw error;
  }
});

// --- Example 2: Delete Operation ---
export const deleteMenuItem = asyncHandler(async (req, res) => {
  const { itemId } = req.params;

  try {
    if (!itemId) {
      logFailedRequest(new Error('Item ID missing'), {
        message: 'Delete menu item validation failed',
        endpoint: req.path,
        method: req.method,
        userId: req.user?.id,
        restaurantId: req.restaurantId,
        statusCode: 400,
        action: 'delete_menu_item_validation',
      });
      return sendError(res, 400, 'Item ID is required');
    }

    const result = await MenuService.deleteItem(itemId);

    logCriticalAction('menu_item_deleted', {
      message: 'Menu item permanently deleted',
      userId: req.user?.id,
      restaurantId: req.restaurantId,
      severity: 'critical',  // Mark as critical because it's a delete
      details: { itemId, itemName: result.name },
    });

    return sendSuccess(res, 200, result, 'Menu item deleted');
  } catch (error) {
    logError(error, {
      message: 'Failed to delete menu item',
      endpoint: req.path,
      method: req.method,
      userId: req.user?.id,
      restaurantId: req.restaurantId,
      itemId,
      statusCode: 500,
      action: 'delete_menu_item',
    });
    throw error;
  }
});

// --- Example 3: Update Operation with Validation ---
export const updateRestaurant = asyncHandler(async (req, res) => {
  try {
    if (!req.body.name && !req.body.phone && !req.body.address) {
      logFailedRequest(new Error('No valid fields provided'), {
        message: 'Update restaurant validation failed',
        endpoint: req.path,
        method: req.method,
        userId: req.user?.id,
        restaurantId: req.restaurantId,
        statusCode: 400,
        action: 'update_restaurant_validation',
      });
      return sendError(res, 400, 'At least one field must be updated');
    }

    const updated = await RestaurantService.update(req.restaurantId, req.body);

    logCriticalAction('restaurant_updated', {
      message: 'Restaurant information updated',
      userId: req.user?.id,
      restaurantId: req.restaurantId,
      details: { updatedFields: Object.keys(req.body) },
    });

    return sendSuccess(res, 200, updated, 'Restaurant updated');
  } catch (error) {
    logError(error, {
      message: 'Failed to update restaurant',
      endpoint: req.path,
      method: req.method,
      userId: req.user?.id,
      restaurantId: req.restaurantId,
      statusCode: 500,
      action: 'update_restaurant',
    });
    throw error;
  }
});

// ============ WHAT GETS LOGGED AUTOMATICALLY ============

// Every API request logs:
// - Method (GET, POST, etc.)
// - Path
// - Origin
// - User IP
// - Response status

// Every asyncHandler error logs:
// - Error message
// - Stack trace
// - Passes to error handler

// Every structured log includes:
// - Timestamp (automatic)
// - Log level (automatic)
// - All context you provide

// ============ VIEWING LOGS ============

// Watch logs in real time (Linux/Mac):
// tail -f logs/error.log
// tail -f logs/app.log

// Search logs for specific order:
// grep "orderId.*12345" logs/error.log

// Filter by user:
// grep "userId.*user123" logs/app.log

// Find all errors from yesterday:
// grep "2024-04-09" logs/error.log

// ============ KEY TIPS ============

// ✅ Always include context (userId, restaurantId, etc.)
// ✅ Use try-catch in every endpoint
// ✅ Log validation failures with logFailedRequest
// ✅ Log critical actions with logCriticalAction
// ✅ Log errors with logError
// ✅ Let asyncHandler catch errors - DON'T return from catch
// ✅ Always throw errors in catch block so asyncHandler gets them
// ✅ Include relevant IDs in details object
// ✅ Use action field to identify what endpoint/operation
// ✅ Set severity: 'critical' for important operations

// ============ COMMON MISTAKES TO AVOID ============

// ❌ DON'T: Log without throwing
// ✅ DO: Log error, then throw error so asyncHandler catches it
export const good = asyncHandler(async (req, res) => {
  try {
    // operation
  } catch (error) {
    logError(error, { action: 'my_action' });
    throw error; // ✅ Let asyncHandler catch it
  }
});

// ❌ DON'T: Missing required context
// ✅ DO: Always include userId and restaurantId
logError(error, {
  message: 'Failed',
  userId: req.user?.id,           // ✅ Include
  restaurantId: req.restaurantId,  // ✅ Include
  action: 'my_action'              // ✅ Include
});

// ❌ DON'T: Log then return error response yourself
// ✅ DO: Log, throw, let asyncHandler handle
logError(error, { action });
throw error; // ✅ asyncHandler will catch and error handler will respond

// ============ SUMMARY ============

/*
Requirements met:

✅ Structured logging added across all APIs
✅ Error logging with full context
✅ Failed request tracking
✅ Critical action monitoring
✅ Try-catch blocks everywhere
✅ No app crashes on errors
✅ Easy debugging with logs
✅ Production issue tracking

To add logging to new endpoints:
1. Import the logging functions
2. Wrap code in try-catch
3. Log validation failures with logFailedRequest
4. Log important actions with logCriticalAction
5. Log errors with logError
6. Always throw errors so asyncHandler catches them
7. Include context (user, restaurant, action)
*/
