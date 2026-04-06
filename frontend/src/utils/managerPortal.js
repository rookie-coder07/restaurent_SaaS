import { compareTableLabels, parseServerDate } from './formatters';

export const ORDER_STATUS_STEPS = ['pending', 'preparing', 'ready'];
export const ACTIVE_ORDER_STATUSES = new Set(['awaiting_waiter_approval', 'pending', 'preparing', 'ready', 'served']);
export const UNPAID_STATUSES = new Set(['unpaid', 'pending', 'partial']);

export function getOrderSourceLabel(order) {
  if (order?.origin === 'qr' || order?.source === 'qr' || order?.orderType === 'qr') {
    return 'QR Order';
  }

  if (order?.origin === 'pos') {
    return 'POS Order';
  }

  if (order?.online?.workflowStatus) {
    return 'Online Order';
  }

  if (order?.source === 'waiter' || order?.orderType === 'dine-in') {
    return 'POS Order';
  }

  if (order?.source === 'pos' || order?.paymentMethod) {
    return 'POS Order';
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

function buildMergeGroups(allTables = [], tableMerges = []) {
  const parent = new Map();
  const createdAtList = [...(tableMerges || [])].sort(
    (left, right) => new Date(left?.createdAt || 0) - new Date(right?.createdAt || 0)
  );

  const ensure = (tableId) => {
    if (!tableId) {
      return;
    }

    if (!parent.has(tableId)) {
      parent.set(tableId, tableId);
    }
  };

  const find = (tableId) => {
    ensure(tableId);

    let current = parent.get(tableId);
    while (current !== parent.get(current)) {
      current = parent.get(current);
    }

    let node = tableId;
    while (node !== current) {
      const next = parent.get(node);
      parent.set(node, current);
      node = next;
    }

    return current;
  };

  const union = (primaryTableId, secondaryTableId) => {
    const primaryRoot = find(primaryTableId);
    const secondaryRoot = find(secondaryTableId);

    if (primaryRoot === secondaryRoot) {
      return;
    }

    parent.set(secondaryRoot, primaryRoot);
  };

  (allTables || []).forEach((table) => ensure(table.id));

  createdAtList.forEach((merge) => {
    const primaryTableId = merge?.primaryTableId;
    const secondaryTableIds = merge?.secondaryTableIds || [];

    ensure(primaryTableId);
    secondaryTableIds.forEach((tableId) => union(primaryTableId, tableId));
  });

  const groups = new Map();
  (allTables || []).forEach((table) => {
    const rootId = find(table.id);
    const current = groups.get(rootId) || [];
    current.push(table.id);
    groups.set(rootId, current);
  });

  return { find, groups };
}

function buildMergedTableMeta(table, allTables = [], tableMerges = []) {
  const tableLookup = new Map((allTables || []).map((entry) => [entry.id, entry]));
  const { find, groups } = buildMergeGroups(allTables, tableMerges);
  const rootId = find(table.id);
  const mergedTableIds = groups.get(rootId) || [table.id];
  const canonicalTable = tableLookup.get(rootId) || table;

  const mergedTableNumbers = mergedTableIds
    .map((tableId) => tableLookup.get(tableId)?.tableNumber)
    .filter((value) => value !== undefined && value !== null)
    .sort((left, right) => compareTableLabels(left, right));

  const mergedDisplayName = mergedTableNumbers.length > 1
    ? `Table ${mergedTableNumbers.join(' + ')}`
    : `Table ${canonicalTable.tableNumber}`;

  return {
    isMergedPrimary: mergedTableIds.length > 1 && canonicalTable.id === table.id,
    isMergedSecondary: canonicalTable.id !== table.id,
    mergedIntoTableId: canonicalTable.id === table.id ? '' : canonicalTable.id,
    mergedTableIds,
    mergedTableNumbers,
    mergedDisplayName,
  };
}

export function getTableActivity(
  table,
  openBills = [],
  tableAssignments = {},
  tableClosures = {},
  tableTransfers = [],
  tableMerges = [],
  allTables = []
) {
  const activeOrders = openBills.filter(
    (order) =>
      order.tableId === table.id &&
      ACTIVE_ORDER_STATUSES.has(order.status)
  );
  const closure = tableClosures[table.id];
  const assignedWaiterId = table.assignedTo || tableAssignments[table.id] || '';
  const isClosed = table.status === 'closed' || Boolean(closure?.closed);
  const isQrLocked = Boolean(table.lockedByQr);
  const hasActiveOrders = activeOrders.length > 0;
  const mergedMeta = buildMergedTableMeta(table, allTables, tableMerges);

  return {
    ...table,
    activeOrders,
    assignedWaiterId,
    assignedWaiterName: table.assignedWaiterName || '',
    lockedByQr: isQrLocked,
    isClosed,
    closureNote: closure?.note || '',
    ...mergedMeta,
    effectiveStatus: closure?.closed
      ? 'closed'
      : isQrLocked
        ? 'qr_locked'
        : hasActiveOrders
          ? 'manual'
        : table.status === 'closed'
          ? 'closed'
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
