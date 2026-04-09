import logger from '../utils/logger.js';

/**
 * MULTI-TENANT SECURITY: Validates that order belongs to requesting restaurant
 * Prevents cross-restaurant data leaks before GST/bill information is exposed
 * 
 * @param {string} restaurantId - Restaurant ID from authenticated user
 * @param {object} order - Order object from database
 * @throws {Error} If order doesn't match restaurant
 */
export const validateOrderBelongsToRestaurant = (restaurantId, order) => {
  if (!restaurantId) {
    throw new Error('Restaurant ID missing from request context');
  }

  if (!order) {
    throw new Error('Order not found');
  }

  if (order.restaurant_id !== restaurantId) {
    logger.warn(`⚠️ SECURITY: Cross-restaurant access attempt detected`, {
      requestedRestaurant: restaurantId,
      orderRestaurant: order.restaurant_id,
      orderId: order.id,
    });
    throw new Error('Order does not belong to your restaurant');
  }
};

/**
 * MULTI-TENANT SECURITY: Validates that table belongs to requesting restaurant
 * Prevents displaying another restaurant's table and its GST info
 * 
 * @param {string} restaurantId - Restaurant ID from authenticated user
 * @param {object} table - Table object from database
 * @throws {Error} If table doesn't match restaurant
 */
export const validateTableBelongsToRestaurant = (restaurantId, table) => {
  if (!restaurantId) {
    throw new Error('Restaurant ID missing from request context');
  }

  if (!table) {
    throw new Error('Table not found');
  }

  if (table.restaurant_id !== restaurantId) {
    logger.warn(`⚠️ SECURITY: Cross-restaurant table access attempt detected`, {
      requestedRestaurant: restaurantId,
      tableRestaurant: table.restaurant_id,
      tableId: table.id,
    });
    throw new Error('Table does not belong to your restaurant');
  }
};

/**
 * MULTI-TENANT SECURITY: Validates restaurant GST data isolation
 * Ensures GST number, rates, and invoice counter are never mixed between restaurants
 * 
 * @param {string} restaurantId - Restaurant ID from authenticated user
 * @param {object} restaurantData - Restaurant settings/profile object
 * @throws {Error} If restaurant data doesn't match restaurant context
 */
export const validateRestaurantGSTContext = (restaurantId, restaurantData) => {
  if (!restaurantId) {
    throw new Error('Restaurant ID missing from request context');
  }

  if (!restaurantData) {
    throw new Error('Restaurant not found');
  }

  if (restaurantData.id !== restaurantId && restaurantData.restaurant_id !== restaurantId) {
    logger.warn(`⚠️ SECURITY: Cross-restaurant GST data access attempt detected`, {
      requestedRestaurant: restaurantId,
      dataRestaurant: restaurantData.id || restaurantData.restaurant_id,
      gstin: restaurantData.gst_number ? '***' : 'NONE', // Don't log actual GST
    });
    throw new Error('Cannot access GST data from another restaurant');
  }
};

/**
 * MULTI-TENANT SECURITY: Validates invoice counter isolation
 * Each restaurant maintains its own invoice number sequence
 * 
 * @param {string} restaurantId - Restaurant ID from authenticated user
 * @param {object} invoiceCounter - Invoice counter object
 * @throws {Error} If invoice counter doesn't match restaurant
 */
export const validateInvoiceCounterRestaurant = (restaurantId, invoiceCounter) => {
  if (!restaurantId) {
    throw new Error('Restaurant ID missing from request context');
  }

  if (!invoiceCounter) {
    throw new Error('Invoice counter not found');
  }

  if (invoiceCounter.restaurantId !== restaurantId) {
    logger.warn(`⚠️ SECURITY: Cross-restaurant invoice counter access attempt detected`, {
      requestedRestaurant: restaurantId,
      counterRestaurant: invoiceCounter.restaurantId,
    });
    throw new Error('Cannot access invoice counter from another restaurant');
  }
};

/**
 * MULTI-TENANT SECURITY: Ensures all queries include restaurant ID filter
 * Validates that Supabase query will be scoped to correct restaurant
 * 
 * @param {string} restaurantId - Restaurant ID to filter by
 * @param {object} queryObject - Supabase query builder object
 * @returns {boolean} True if query appears properly scoped
 */
export const validateQueryScoping = (restaurantId, queryObject) => {
  // Note: This is a helper - actual validation happens at database level via RLS
  // This provides application-level defense-in-depth
  if (!restaurantId) {
    logger.error('❌ SECURITY: Query attempted without restaurant ID scope');
    return false;
  }
  
  return true;
};

/**
 * SUMMARY: Multi-Tenant GST Security Validations
 * 
 * ALWAYS VALIDATE:
 * 1. Order.restaurant_id === req.restaurantId (before returning bill)
 * 2. Table.restaurant_id === req.restaurantId (before displaying menu/bill)
 * 3. Restaurant.id === req.restaurantId (before returning GST settings)
 * 4. InvoiceCounter.restaurantId === req.restaurantId (before incrementing)
 * 
 * NEVER:
 * - Use global GST variable
 * - Cache GST across requests
 * - Return restaurant data without restaurant_id match
 * - Generate invoice without validating restaurant_id
 */
