import { formatCurrency, formatDisplayOrderNumber } from './formatters';

export const ACTIVE_ORDER_STATUSES = new Set(['awaiting_waiter_approval', 'pending', 'preparing', 'ready', 'served']);
export const UNPAID_PAYMENT_STATUSES = new Set(['', 'unpaid', 'pending', 'partial']);

export function getHourLabel(hour) {
  const normalizedHour = Number(hour || 0);
  const suffix = normalizedHour >= 12 ? 'PM' : 'AM';
  const twelveHour = normalizedHour % 12 || 12;
  return `${twelveHour}:00 ${suffix}`;
}

export function getOrderAgeMinutes(order) {
  const start = new Date(order.updatedAt || order.createdAt || Date.now()).getTime();
  return Math.max(0, Math.round((Date.now() - start) / 60000));
}

export function isSettledOrder(order) {
  return order?.status === 'completed' || String(order?.paymentStatus || '').toLowerCase() === 'paid';
}

export function isUnpaidOrder(order) {
  return !isSettledOrder(order) && UNPAID_PAYMENT_STATUSES.has(String(order?.paymentStatus || '').toLowerCase());
}

export function getPriorityMeta(priority) {
  return priority === 'critical'
    ? {
        badge: 'bg-red-500/15 text-red-400',
        border: 'border-red-500/20 bg-red-500/6',
        label: 'Critical',
      }
    : {
        badge: 'bg-amber-500/15 text-amber-300',
        border: 'border-amber-500/20 bg-amber-500/6',
        label: 'Warning',
      };
}

export function buildPeakHours(orders = []) {
  const buckets = new Map();

  orders.forEach((order) => {
    const hour = new Date(order.createdAt || Date.now()).getHours();
    const current = buckets.get(hour) || { hour, label: getHourLabel(hour), orders: 0, revenue: 0 };
    current.orders += 1;
    current.revenue += Number(order.totalAmount || order.total || 0);
    buckets.set(hour, current);
  });

  return Array.from(buckets.values())
    .sort((left, right) => right.orders - left.orders || right.revenue - left.revenue)
    .slice(0, 4);
}

export function buildSmartNotifications({
  orders = [],
  lowStockItems = [],
  approvedDiscounts = {},
}) {
  const notifications = [];
  const getDiscountRecipientLabel = (order) => {
    if (order?.online?.customerName) {
      return order.online.customerName;
    }

    if (order?.online?.customerPhone) {
      return order.online.customerPhone;
    }

    if (order?.loyalty?.customerPhone) {
      return order.loyalty.customerPhone;
    }

    if (order?.tableNumber) {
      return `Table ${order.tableNumber}`;
    }

    return 'Walk-in guest';
  };

  lowStockItems.forEach((item) => {
    notifications.push({
      id: `low-stock-${item.id}`,
      title: `${item.name} is low on stock`,
      detail: `${item.quantity} ${item.unit} left in inventory.`,
      priority: item.quantity <= Math.max(1, item.threshold * 0.5) ? 'critical' : 'warning',
      timestamp: item.updatedAt || item.lastUpdated || item.createdAt,
      category: 'inventory',
      sourceRole: 'system',
      sourceType: 'inventory_low',
      status: 'live',
    });
  });

  orders
    .filter((order) => ACTIVE_ORDER_STATUSES.has(order.status))
    .filter((order) => getOrderAgeMinutes(order) >= 30)
    .forEach((order) => {
      notifications.push({
        id: `delay-${order.id}`,
        title: `${formatDisplayOrderNumber(order)} is delayed`,
        detail: `Live for ${getOrderAgeMinutes(order)} minutes on table ${order.tableNumber || 'N/A'}.`,
        priority: getOrderAgeMinutes(order) >= 45 ? 'critical' : 'warning',
        timestamp: order.updatedAt || order.createdAt,
        category: 'orders',
        sourceRole: order.orderType === 'dine-in' ? 'waiter' : 'system',
        sourceType: 'order_delay',
        status: 'live',
      });
    });

  orders
    .filter((order) => order.status === 'cancelled')
    .forEach((order) => {
      notifications.push({
        id: `cancelled-${order.id}`,
        title: `${formatDisplayOrderNumber(order)} was cancelled`,
        detail: `Cancelled order at table ${order.tableNumber || 'N/A'}.`,
        priority: 'warning',
        timestamp: order.updatedAt || order.createdAt,
        category: 'orders',
        sourceRole: 'system',
        sourceType: 'order_cancelled',
        status: 'resolved',
      });
    });

  orders
    .filter((order) => Number(order?.approvedDiscount?.percent || 0) > 0)
    .forEach((order) => {
      const discountPercent = Number(order?.approvedDiscount?.percent || 0);
      const recipient = getDiscountRecipientLabel(order);
      notifications.push({
        id: `discount-approval-${order.id}`,
        title: `Discount approved on ${formatDisplayOrderNumber(order)}`,
        detail: `${discountPercent}% approved by ${order?.approvedDiscount?.approvedBy || 'manager'} for ${recipient}${order?.approvedDiscount?.note ? ` • ${order.approvedDiscount.note}` : ''}.`,
        priority: discountPercent >= 25 ? 'critical' : 'warning',
        timestamp: order?.approvedDiscount?.approvedAt || order.updatedAt || order.createdAt,
        category: 'billing',
        sourceRole: 'manager',
        sourceType: 'discount_approved',
        status: isSettledOrder(order) || String(order?.status || '').toLowerCase() === 'cancelled' ? 'resolved' : 'live',
      });
    });

  orders
    .filter((order) => isUnpaidOrder(order))
    .forEach((order) => {
      notifications.push({
        id: `bill-${order.id}`,
        title: `Bill generated for ${formatDisplayOrderNumber(order)}`,
        detail: `${formatCurrency(order.totalAmount || order.total || 0)} is still pending payment.`,
        priority: Number(order.totalAmount || order.total || 0) >= 3000 ? 'critical' : 'warning',
        timestamp: order.updatedAt || order.createdAt,
        category: 'billing',
        sourceRole: order.orderType === 'dine-in' ? 'waiter' : 'system',
        sourceType: 'bill_generated',
        status: 'live',
      });
    });

  orders
    .filter((order) => Number(order?.billing?.managerDiscountPercent || 0) > 0 || Number(order?.billing?.managerDiscountAmount || 0) > 0)
    .forEach((order) => {
      const discountPercent = Number(order?.billing?.managerDiscountPercent || 0);
      const discountAmount = Number(order?.billing?.managerDiscountAmount || 0);
      const appliedBy = order?.billing?.cashierName || 'manager';
      const recipient = getDiscountRecipientLabel(order);

      notifications.push({
        id: `manager-discount-${order.id}`,
        title: `Discount applied on ${formatDisplayOrderNumber(order)}`,
        detail: `${discountPercent}% (${formatCurrency(discountAmount)}) by ${appliedBy} for ${recipient}.`,
        priority: discountPercent >= 25 || discountAmount >= 1000 ? 'critical' : 'warning',
        timestamp: order.updatedAt || order.createdAt,
        category: 'billing',
        sourceRole: 'manager',
        sourceType: 'manager_discount',
        status: isSettledOrder(order) ? 'resolved' : 'live',
      });
    });

  orders
    .filter((order) => isSettledOrder(order))
    .slice(0, 8)
    .forEach((order) => {
      notifications.push({
        id: `paid-${order.id}`,
        title: `${formatDisplayOrderNumber(order)} was settled`,
        detail: `Collected ${formatCurrency(order.totalAmount || order.total || 0)} from table ${order.tableNumber || 'N/A'}.`,
        priority: 'warning',
        timestamp: order.updatedAt || order.createdAt,
        category: 'billing',
        sourceRole: 'waiter',
        sourceType: 'bill_settled',
        status: 'resolved',
      });
    });

  return notifications.sort((left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0));
}

export function buildActivityLog({
  orders = [],
  staff = [],
  tables = [],
  recentHistory = [],
  tableClosures = {},
  tableTransfers = [],
  tableMerges = [],
  approvedDiscounts = {},
  stockRequests = [],
  waiterActivity = {},
}) {
  const tableNumberMap = new Map((tables || []).map((table) => [table.id, table.tableNumber]));
  const staffNameMap = new Map((staff || []).map((member) => [member.id, member.name || member.email || 'Staff']));
  const events = [];

  orders.slice(0, 6).forEach((order) => {
    const actionLabel =
      order.status === 'cancelled'
        ? 'Order cancelled'
        : isSettledOrder(order)
          ? 'Bill settled'
          : order.status === 'ready'
            ? 'Order marked ready'
            : 'Order updated';

    events.push({
      id: `order-${order.id}`,
      actor: order.orderType === 'dine-in' ? 'Waiter' : 'System',
      message: `${actionLabel} for ${formatDisplayOrderNumber(order)}`,
      detail: `Table ${order.tableNumber || 'N/A'} • ${formatCurrency(order.totalAmount || order.total || 0)}`,
      timestamp: order.updatedAt || order.createdAt,
      category: 'order',
    });
  });

  (recentHistory || []).slice(0, 6).forEach((entry) => {
    events.push({
      id: `inventory-${entry.id}`,
      actor: 'Inventory',
      message: `${entry.inventoryItemName || 'Inventory item'} ${entry.type}`,
      detail: `${entry.quantityBefore} -> ${entry.quantityAfter} ${entry.unit}${entry.reason ? ` • ${entry.reason}` : ''}`,
      timestamp: entry.createdAt,
      category: 'inventory',
    });
  });

  Object.entries(waiterActivity || {}).forEach(([waiterId, activity]) => {
    events.push({
      id: `waiter-${waiterId}`,
      actor: staffNameMap.get(waiterId) || 'Waiter',
      message: `Waiter ${String(activity.action || 'updated').replaceAll('_', ' ')}`,
      detail: activity.tableId ? `Table ${tableNumberMap.get(activity.tableId) || activity.tableId}` : 'Floor action logged',
      timestamp: activity.updatedAt,
      category: 'waiter',
    });
  });

  Object.entries(tableClosures || {}).forEach(([tableId, closure]) => {
    if (!closure?.closed) {
      return;
    }

    events.push({
      id: `closure-${tableId}`,
      actor: 'Manager',
      message: `Manager closed table ${tableNumberMap.get(tableId) || tableId}`,
      detail: closure.note || 'Table closure recorded in manager workspace.',
      timestamp: closure.updatedAt,
      category: 'manager',
    });
  });

  (tableTransfers || []).forEach((transfer) => {
    events.push({
      id: transfer.id,
      actor: 'Manager',
      message: `Manager transferred table ${tableNumberMap.get(transfer.fromTableId) || transfer.fromTableId} to table ${tableNumberMap.get(transfer.toTableId) || transfer.toTableId}`,
      detail: transfer.note || 'Table transfer',
      timestamp: transfer.createdAt,
      category: 'manager',
    });
  });

  (tableMerges || []).forEach((merge) => {
    events.push({
      id: merge.id,
      actor: 'Manager',
      message: `Manager merged tables into ${tableNumberMap.get(merge.primaryTableId) || merge.primaryTableId}`,
      detail: `${merge.secondaryTableIds?.length || 0} linked table(s) merged.`,
      timestamp: merge.createdAt,
      category: 'manager',
    });
  });

  Object.entries(approvedDiscounts || {}).forEach(([orderId, discount]) => {
    events.push({
      id: `discount-log-${orderId}`,
      actor: discount.approvedBy || 'Manager',
      message: `Discount approved on order ${orderId.slice(0, 8)}`,
      detail: `${discount.percent}% discount${discount.note ? ` • ${discount.note}` : ''}`,
      timestamp: discount.approvedAt,
      category: 'manager',
    });
  });

  (stockRequests || []).forEach((request) => {
    events.push({
      id: request.id,
      actor: 'Manager',
      message: `Refill requested for ${request.itemName}`,
      detail: `${request.quantity} units requested${request.note ? ` • ${request.note}` : ''}`,
      timestamp: request.createdAt,
      category: 'manager',
    });
  });

  return events
    .sort((left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0))
    .slice(0, 24);
}
