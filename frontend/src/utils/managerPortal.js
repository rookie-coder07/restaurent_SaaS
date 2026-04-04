import { parseServerDate } from './formatters';

export const ORDER_STATUS_STEPS = ['pending', 'preparing', 'ready'];
export const ACTIVE_ORDER_STATUSES = new Set(['awaiting_waiter_approval', 'pending', 'preparing', 'ready', 'served']);
export const UNPAID_STATUSES = new Set(['unpaid', 'pending', 'partial']);
export const DISCOUNT_LIMIT_PERCENT = 15;
export const MANAGER_DISCOUNT_LIMIT = 15;

export function getOrderSourceLabel(order) {
  if (order?.online?.workflowStatus || order?.source === 'qr' || order?.orderType === 'qr') {
    return 'QR';
  }

  if (order?.source === 'waiter' || order?.orderType === 'dine-in') {
    return 'Waiter';
  }

  if (order?.source === 'pos' || order?.paymentMethod) {
    return 'POS';
  }

  return 'Service';
}

export function getOrderAgeMinutes(value) {
  const createdAt = parseServerDate(value);
  if (!createdAt) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 60000));
}

export function isDelayedOrder(order, thresholdMinutes = 15) {
  return getOrderAgeMinutes(order?.createdAt) >= thresholdMinutes && ['pending', 'preparing'].includes(order?.status);
}

export function isBusyTable(table) {
  return (table?.activeOrders || []).length >= 2;
}

export function isUnpaid(order) {
  return !order?.paymentStatus || UNPAID_STATUSES.has(String(order.paymentStatus).toLowerCase());
}

export function isSettled(order) {
  return order?.status === 'completed' || String(order?.paymentStatus).toLowerCase() === 'paid';
}

export function getTableActivity(table, openBills = [], tableAssignments = {}, tableClosures = {}) {
  const activeOrders = openBills.filter((order) => order.tableId === table.id && ACTIVE_ORDER_STATUSES.has(order.status));
  const closure = tableClosures[table.id];
  const assignedWaiterId = tableAssignments[table.id] || '';

  return {
    ...table,
    activeOrders,
    assignedWaiterId,
    isClosed: Boolean(closure?.closed),
    closureNote: closure?.note || '',
    effectiveStatus: closure?.closed
      ? 'closed'
      : activeOrders.length > 0
        ? 'busy'
        : table.status === 'reserved' || table.reservedBy
          ? 'reserved'
          : 'open',
  };
}

export function getTopSellingItems(orders = []) {
  const byItem = new Map();

  orders.forEach((order) => {
    (order.items || []).forEach((item) => {
      const key = item.menuItemId || item.id || item.name;
      const existing = byItem.get(key) || {
        key,
        name: item.name || 'Unknown item',
        quantity: 0,
        revenue: 0,
      };

      existing.quantity += Number(item.quantity || 0);
      existing.revenue += Number((item.unitPrice || item.price || 0) * (item.quantity || 0));
      byItem.set(key, existing);
    });
  });

  return Array.from(byItem.values()).sort((left, right) => right.quantity - left.quantity);
}
