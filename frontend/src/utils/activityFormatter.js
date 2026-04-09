/**
 * Activity Details Formatter - Display staff activity in user-friendly format
 * Frontend utility for formatting activity log details
 */

/**
 * Map of action types to display labels with emojis
 */
export const ACTION_LABELS = {
  'order_created': '📋 Order Created',
  'item_added': '🛒 Item Added',
  'item_removed': '🗑️ Item Removed',
  'order_settled': '✅ Order Settled',
  'order_cancelled': '❌ Order Cancelled',
  'order_split': '📊 Order Split',
  'order_edited': '✏️ Order Edited',
  'bill_paid': '💳 Bill Paid',
  'bill_voided': '⛔ Bill Voided',
  'table_assigned': '🪑 Table Assigned',
  'table_reassigned': '📍 Table Reassigned',
  'table_merged': '🔀 Tables Merged',
  'table_transferred': '↔️ Table Transferred',
  'order_sent_kitchen': '👨‍🍳 Sent to Kitchen',
  'kot_printed': '🖨️ KOT Printed',
  'inventory_updated': '📦 Inventory Updated',
  'staff_logged_in': '👤 Staff Login',
  'staff_logged_out': '👋 Staff Logout',
  'password_changed': '🔐 Password Changed',
  'role_changed': '🎯 Role Changed',
  'permission_updated': '🔑 Permission Updated',
  'discount_applied': '🏷️ Discount Applied',
  'gst_charged': '📈 GST Charged',
  'payment_received': '💰 Payment Received',
  'order_reordered': '🔄 Order Reordered',
};

/**
 * Format currency for display
 */
const formatCurrency = (amount) => {
  return `₹${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

/**
 * Get user-friendly order display (like "#05" instead of UUID)
 */
const getOrderDisplay = (order) => {
  if (order?.displayOrderNumber) {
    return order.displayOrderNumber;
  }
  if (order?.id) {
    return `#${String(order.id).slice(-2).toUpperCase()}`;
  }
  return 'Order';
};

/**
 * Get user-friendly table number (like "Table 5" instead of UUID)
 */
const getTableDisplay = (table) => {
  if (table?.tableNumber) {
    return `Table ${table.tableNumber}`;
  }
  if (table?.id) {
    return `Table #${String(table.id).slice(-1)}`;
  }
  return 'Table';
};

/**
 * Format order created activity
 */
const formatOrderCreated = (details) => {
  if (!details || !details.orderId) return null;
  
  const orderDisplay = details.displayOrderNumber ? details.displayOrderNumber : `#${String(details.orderId).slice(-2).toUpperCase()}`;
  const tableDisplay = details.tableNumber ? `Table ${details.tableNumber}` : `Table #${String(details.tableId).slice(-1)}`;
  
  return {
    title: 'Order Created',
    items: [
      { label: 'Order', value: orderDisplay },
      { label: 'Table', value: tableDisplay },
      { label: 'Items', value: details.itemCount || 0 },
      { label: 'Total', value: formatCurrency(details.totalAmount) },
      { label: 'Type', value: details.orderType || 'dine-in' },
    ],
    highlight: formatCurrency(details.totalAmount)
  };
};

/**
 * Format item added activity
 */
const formatItemAdded = (details) => {
  if (!details || !details.items) return null;
  
  const items = Array.isArray(details.items) ? details.items : [details.items];
  const totalItems = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const totalPrice = items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0);
  const orderDisplay = details.displayOrderNumber ? details.displayOrderNumber : `#${String(details.orderId).slice(-2).toUpperCase()}`;
  
  return {
    title: 'Items Added to Order',
    items: [
      { label: 'Order', value: orderDisplay },
      { label: 'Items Added', value: totalItems },
      { label: 'Total Value', value: formatCurrency(totalPrice) },
      { 
        label: 'Items', 
        value: items.map(i => `${i.quantity}x @ ₹${i.unitPrice}`).join(', ')
      },
    ],
    highlight: `${totalItems} items (${formatCurrency(totalPrice)})`
  };
};

/**
 * Format order settled activity
 */
const formatOrderSettled = (details) => {
  if (!details || !details.orderId) return null;
  
  const orderDisplay = details.displayOrderNumber ? details.displayOrderNumber : `#${String(details.orderId).slice(-2).toUpperCase()}`;
  const tableDisplay = details.tableNumber ? `Table ${details.tableNumber}` : `Table #${String(details.tableId).slice(-1)}`;
  
  return {
    title: 'Order Settled',
    items: [
      { label: 'Order', value: orderDisplay },
      { label: 'Table', value: tableDisplay },
      { label: 'Amount Paid', value: formatCurrency(details.totalAmount) },
      { label: 'Payment Method', value: details.paymentMethod || 'Cash' },
      { label: 'Status', value: 'Completed' },
    ],
    highlight: formatCurrency(details.totalAmount)
  };
};

/**
 * Format table assigned activity
 */
const formatTableAssigned = (details) => {
  if (!details || !details.tableId) return null;
  
  const tableDisplay = details.tableNumber ? `Table ${details.tableNumber}` : `Table #${String(details.tableId).slice(-1)}`;
  
  return {
    title: 'Table Assigned',
    items: [
      { label: 'Table', value: tableDisplay },
      { label: 'Capacity', value: `${details.capacity || 'N/A'} seats` },
      { label: 'Status', value: 'In Use' },
    ],
    highlight: tableDisplay
  };
};

/**
 * Format bill paid activity
 */
const formatBillPaid = (details) => {
  if (!details || !details.totalAmount) return null;
  
  const orderDisplay = details.displayOrderNumber ? details.displayOrderNumber : `#${String(details.orderId).slice(-2).toUpperCase()}`;
  const tableDisplay = details.tableNumber ? `Table ${details.tableNumber}` : `Table #${String(details.tableId).slice(-1)}`;
  
  return {
    title: 'Bill Settled',
    items: [
      { label: 'Order', value: orderDisplay },
      { label: 'Amount Collected', value: formatCurrency(details.totalAmount) },
      { label: 'Payment Method', value: details.paymentMethod || 'Cash' },
      { label: 'Table', value: tableDisplay },
    ],
    highlight: formatCurrency(details.totalAmount)
  };
};

/**
 * Format staff login activity
 */
const formatStaffLogin = (details) => {
  return {
    title: 'Staff Login',
    items: [
      { label: 'Role', value: details.role || 'Staff' },
      { label: 'Name', value: details.staffName || 'Unknown' },
      { label: 'Status', value: 'Logged In' },
    ],
    highlight: 'Active Session'
  };
};

/**
 * Format staff logout activity
 */
const formatStaffLogout = (details) => {
  return {
    title: 'Staff Logout',
    items: [
      { label: 'Role', value: details.role || 'Staff' },
      { label: 'Session Duration', value: details.sessionDuration || 'N/A' },
      { label: 'Status', value: 'Logged Out' },
    ],
    highlight: 'Session Ended'
  };
};

/**
 * Format inventory updated activity
 */
const formatInventoryUpdated = (details) => {
  if (!details || !details.itemName) return null;
  
  const previousQty = details.previousQuantity || 0;
  const newQty = details.newQuantity || 0;
  const change = newQty - previousQty;
  const changeLabel = change > 0 ? `+${change}` : `${change}`;
  
  return {
    title: 'Inventory Updated',
    items: [
      { label: 'Item', value: details.itemName },
      { label: 'Previous', value: `${previousQty} ${details.unit || 'units'}` },
      { label: 'Current', value: `${newQty} ${details.unit || 'units'}` },
      { label: 'Change', value: `${changeLabel} ${details.unit || 'units'}` },
    ],
    highlight: `${details.itemName}: ${changeLabel}`
  };
};

/**
 * Format discount applied activity
 */
const formatDiscountApplied = (details) => {
  if (!details || !details.discountAmount) return null;
  
  const orderDisplay = details.displayOrderNumber ? details.displayOrderNumber : `#${String(details.orderId).slice(-2).toUpperCase()}`;
  
  return {
    title: 'Discount Applied',
    items: [
      { label: 'Order', value: orderDisplay },
      { label: 'Discount Amount', value: formatCurrency(details.discountAmount) },
      { label: 'Reason', value: details.reason || 'Management decision' },
      { label: 'New Total', value: formatCurrency(details.newTotal) },
    ],
    highlight: `${formatCurrency(details.discountAmount)} off`
  };
};

/**
 * Main formatter function - determines which formatter to use
 */
export const formatActivityDetails = (action, details) => {
  const formatters = {
    'order_created': formatOrderCreated,
    'item_added': formatItemAdded,
    'order_settled': formatOrderSettled,
    'bill_paid': formatBillPaid,
    'table_assigned': formatTableAssigned,
    'staff_logged_in': formatStaffLogin,
    'staff_logged_out': formatStaffLogout,
    'inventory_updated': formatInventoryUpdated,
    'discount_applied': formatDiscountApplied,
  };

  const formatter = formatters[action];
  if (formatter) {
    try {
      return formatter(details);
    } catch (error) {
      console.error(`Error formatting ${action}:`, error);
      return null;
    }
  }

  return null;
};

/**
 * Get formatted activity display
 */
export const getFormattedActivity = (log) => {
  const formatted = formatActivityDetails(log.action, log.details);
  
  if (!formatted) {
    // Fallback to raw details if no specific formatter
    return {
      title: ACTION_LABELS[log.action] || log.action,
      items: log.details && Object.entries(log.details).map(([key, value]) => ({
        label: key.replace(/_/g, ' ').charAt(0).toUpperCase() + key.slice(1),
        value: typeof value === 'object' ? JSON.stringify(value) : String(value)
      })),
      highlight: null
    };
  }

  return formatted;
};

export default {
  ACTION_LABELS,
  formatActivityDetails,
  getFormattedActivity,
};
