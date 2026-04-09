/**
 * Order Display Formatter - User-Friendly Console & Response Formatting
 */

/**
 * Format currency amount
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount) => {
  return `₹${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

/**
 * Format order items with prices
 * @param {Array} items - Order items array
 * @returns {string} Formatted table display
 */
export const formatOrderItems = (items) => {
  if (!items || items.length === 0) return '   (No items)';
  
  const itemsFormatted = items.map((item, idx) => {
    const qty = item.quantity || 1;
    const price = item.unitPrice || 0;
    const total = qty * price;
    return `   ${idx + 1}. Qty: ${qty} x ₹${price} = ${formatCurrency(total)}`;
  }).join('\n');
  
  return itemsFormatted;
};

/**
 * Format entire order for console display
 * @param {Object} order - Order object
 * @param {Array} items - Optional items array
 * @returns {string} Nicely formatted order display
 */
export const formatOrderForConsole = (order, items = []) => {
  const timestamp = new Date().toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  let display = `
╔════════════════════════════════════════════╗
║           ✅ ORDER CREATED                 ║
╚════════════════════════════════════════════╝

📋 ORDER DETAILS:
├─ Order ID:        ${order.orderId || 'N/A'}
├─ Table ID:        ${order.tableId || 'N/A'}
├─ Order Type:      ${order.orderType || 'dine-in'}
├─ Item Count:      ${order.itemCount || items.length}
└─ Total Amount:    ${formatCurrency(order.totalAmount || 0)}

🛒 ITEMS ORDERED:
${formatOrderItems(items)}

📅 Timestamp: ${timestamp}

✨ Status: Order successfully placed!
`;

  return display;
};

/**
 * Format order for JSON response (public API)
 * @param {Object} order - Order object
 * @returns {Object} Clean formatted response object
 */
export const formatOrderResponse = (order) => {
  return {
    orderId: order.id || order.orderId,
    tableId: order.tableId,
    restaurantId: order.restaurantId,
    itemCount: order.itemCount || 0,
    orderType: order.orderType || 'dine-in',
    totalAmount: Number(order.totalAmount || order.total || 0),
    status: order.status || 'pending',
    createdAt: order.createdAt,
    createdBy: order.createdBy,
    items: (order.items || []).map(item => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      menuItemId: item.menuItemId,
      total: item.quantity * item.unitPrice
    }))
  };
};

/**
 * Log order creation in console with friendly formatting
 * @param {Object} order - The created order
 * @param {Array} items - Order items
 * @param {Object} logger - Logger instance
 */
export const logOrderCreation = (order, items = [], logger = console) => {
  const formattedDisplay = formatOrderForConsole(order, items);
  logger.log(formattedDisplay);
};

/**
 * Create a table-like display for order summary
 * @param {Object} order - Order object
 * @returns {string} ASCII table format
 */
export const formatOrderSummaryTable = (order) => {
  const rows = [
    ['Field', 'Value'],
    ['─────────────────', '─────────────────────────'],
    ['Order ID', order.orderId || order.id],
    ['Table ID', order.tableId],
    ['Order Type', order.orderType || 'dine-in'],
    ['Item Count', order.itemCount],
    ['Total Amount', formatCurrency(order.totalAmount || order.total || 0)],
    ['Status', order.status || 'pending'],
    ['Timestamp', new Date().toLocaleTimeString('en-IN')]
  ];

  const colWidths = [18, 32];
  return rows
    .map(row => `│ ${row[0].padEnd(colWidths[0])} │ ${String(row[1]).padEnd(colWidths[1])} │`)
    .join('\n');
};

/**
 * Format quick notification for order
 * @param {Object} order - Order object
 * @returns {string} Quick notification text
 */
export const formatOrderNotification = (order) => {
  return `📋 Order ${order.orderId || order.id} created at Table ${order.tableId} • ${formatCurrency(order.totalAmount || 0)} • ${order.itemCount} items`;
};

export default {
  formatCurrency,
  formatOrderItems,
  formatOrderForConsole,
  formatOrderResponse,
  logOrderCreation,
  formatOrderSummaryTable,
  formatOrderNotification,
};
