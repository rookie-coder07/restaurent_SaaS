import { parseServerDate } from './formatters';

function formatLocalDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function roundMetric(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function getOrderTotal(order) {
  return Number(order?.totalAmount ?? order?.total ?? order?.billing?.grandTotal ?? 0);
}

function getOrderItemsCount(order) {
  return (order?.items || []).reduce((sum, item) => sum + Number(item?.quantity || 0), 0);
}

function getNormalizedOrderType(order) {
  return String(order?.orderType || order?.order_type || (order?.tableId ? 'dine-in' : 'takeaway'))
    .replace(/_/g, '-')
    .toLowerCase();
}

function getKitchenReadyAt(order) {
  if (Array.isArray(order?.kitchenTickets) && order.kitchenTickets.length > 0) {
    const sortedTickets = [...order.kitchenTickets].sort(
      (left, right) => new Date(left?.createdAt || 0).getTime() - new Date(right?.createdAt || 0).getTime()
    );
    const readyTicket = sortedTickets.find((ticket) => ticket?.readyAt || ticket?.servedAt || ticket?.updatedAt);
    return readyTicket?.readyAt || readyTicket?.servedAt || readyTicket?.updatedAt || null;
  }

  return order?.online?.readyAt || null;
}

function getHourLabel(hour) {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const twelveHour = hour % 12 || 12;
  return `${twelveHour}:00 ${suffix}`;
}

export function isSettledAnalyticsOrder(order) {
  const status = String(order?.status || '').toLowerCase();
  const paymentStatus = String(order?.paymentStatus || '').toLowerCase();
  // Order is settled if: status is completed/served, OR payment status is paid
  return status === 'completed' || status === 'served' || paymentStatus === 'paid';
}

export function parseDiscountAmountFromNotes(notes = '') {
  const match = String(notes || '').match(/discount amount\s+(\d+(?:\.\d+)?)/i);
  return match ? Number(match[1]) : 0;
}

export function getAnalyticsPresetRange(preset) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);

  if (preset === 'today') {
    start.setHours(0, 0, 0, 0);
  } else if (preset === 'weekly') {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
  }

  return {
    start: formatLocalDateInputValue(start),
    end: formatLocalDateInputValue(end),
  };
}

export function filterOrdersByDateRange(orders = [], dateRange = {}) {
  return orders.filter((order) => {
    const createdAt = parseServerDate(order?.createdAt);
    if (!createdAt) {
      return false;
    }

    const startMatch = !dateRange.start || createdAt >= new Date(`${dateRange.start}T00:00:00`);
    const endMatch = !dateRange.end || createdAt <= new Date(`${dateRange.end}T23:59:59`);
    return startMatch && endMatch;
  });
}

function filterOrdersByType(orders = [], orderType = 'all') {
  if (!orderType || orderType === 'all') {
    return orders;
  }

  return orders.filter((order) => getNormalizedOrderType(order) === orderType);
}

export function buildAnalyticsSnapshot(orders = [], dateRange = {}, filters = {}) {
  const orderType = filters?.orderType || 'all';
  const dateFilteredOrders = filterOrdersByDateRange(orders, dateRange);
  const filteredOrders = filterOrdersByType(dateFilteredOrders, orderType);
  const settledOrders = filteredOrders.filter((order) => isSettledAnalyticsOrder(order));
  const activeOrders = filteredOrders.filter((order) =>
    ['awaiting_waiter_approval', 'pending', 'preparing', 'ready', 'served'].includes(String(order?.status || '').toLowerCase())
  );
  const cancelledOrdersCount = filteredOrders.filter((order) => String(order?.status || '').toLowerCase() === 'cancelled').length;
  const openOrdersCount = filteredOrders.length - settledOrders.length - cancelledOrdersCount;
  const totalOrders = filteredOrders.length;
  const totalRevenue = roundMetric(settledOrders.reduce((sum, order) => sum + getOrderTotal(order), 0));
  const totalDiscounts = roundMetric(settledOrders.reduce((sum, order) => sum + parseDiscountAmountFromNotes(order?.notes), 0));
  const netSales = roundMetric(totalRevenue - totalDiscounts);
  const averageOrderValue = settledOrders.length > 0 ? roundMetric(totalRevenue / settledOrders.length) : 0;

  const dailyRevenueMap = new Map();
  const orderHourMap = new Map();
  const itemMap = new Map();
  const paymentMethodMap = new Map();
  const orderTypeCounts = { dineIn: 0, takeaway: 0 };
  const prepDurations = [];
  const completionDurations = [];
  const dineInSettledTableIds = new Set();

  filteredOrders.forEach((order) => {
    const createdAt = parseServerDate(order?.createdAt);
    if (!createdAt) {
      return;
    }

    const orderTotal = getOrderTotal(order);
    const orderDiscount = parseDiscountAmountFromNotes(order?.notes);
    const orderTypeLabel = getNormalizedOrderType(order);

    if (orderTypeLabel === 'dine-in') {
      orderTypeCounts.dineIn += 1;
      if (isSettledAnalyticsOrder(order) && order?.tableId) {
        dineInSettledTableIds.add(order.tableId);
      }
    } else {
      orderTypeCounts.takeaway += 1;
    }

    const dayLabel = new Intl.DateTimeFormat('en-IN', {
      month: 'short',
      day: 'numeric',
    }).format(createdAt);
    const dailyEntry = dailyRevenueMap.get(dayLabel) || {
      date: dayLabel,
      sortKey: new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate()).getTime(),
      revenue: 0,
      orders: 0,
    };
    dailyEntry.orders += 1;
    if (isSettledAnalyticsOrder(order)) {
      dailyEntry.revenue += orderTotal;
    }
    dailyRevenueMap.set(dayLabel, dailyEntry);

    const orderHour = createdAt.getHours();
    const hourEntry = orderHourMap.get(orderHour) || {
      hour: orderHour,
      label: getHourLabel(orderHour),
      orders: 0,
      revenue: 0,
    };
    hourEntry.orders += 1;
    if (isSettledAnalyticsOrder(order)) {
      hourEntry.revenue += orderTotal;
    }
    orderHourMap.set(orderHour, hourEntry);

    const paymentLabel = String(order?.paymentMethod || order?.payment_mode || order?.billing?.paymentMode || (isSettledAnalyticsOrder(order) ? 'unknown' : 'pending'))
      .replace(/_/g, ' ')
      .trim()
      .toUpperCase();
    const paymentEntry = paymentMethodMap.get(paymentLabel) || {
      name: paymentLabel,
      value: 0,
    };
    paymentEntry.value += 1;
    paymentMethodMap.set(paymentLabel, paymentEntry);

    (order?.items || []).forEach((item) => {
      const itemName = item?.name || 'Unknown item';
      const currentItem = itemMap.get(itemName) || {
        name: itemName,
        quantity: 0,
        revenue: 0,
      };
      const quantity = Number(item?.quantity || 0);
      const unitPrice = Number(item?.price ?? item?.unitPrice ?? 0);
      currentItem.quantity += quantity;
      currentItem.revenue += unitPrice * quantity;
      itemMap.set(itemName, currentItem);
    });

    const readyAt = parseServerDate(getKitchenReadyAt(order));
    if (readyAt) {
      const prepMinutes = (readyAt.getTime() - createdAt.getTime()) / 60000;
      if (prepMinutes >= 0) {
        prepDurations.push(prepMinutes);
      }
    }

    if (isSettledAnalyticsOrder(order)) {
      const completionAt = parseServerDate(order?.updatedAt || order?.billing?.invoiceDate || null);
      if (completionAt) {
        const completionMinutes = (completionAt.getTime() - createdAt.getTime()) / 60000;
        if (completionMinutes >= 0) {
          completionDurations.push(completionMinutes);
        }
      }
    }
  });

  const rankedItems = Array.from(itemMap.values()).sort(
    (left, right) => right.quantity - left.quantity || right.revenue - left.revenue
  );
  const topItems = rankedItems.slice(0, 5);
  const lowPerformingItems = rankedItems
    .filter((item) => item.quantity > 0)
    .sort((left, right) => left.quantity - right.quantity || left.revenue - right.revenue)
    .slice(0, 5);
  const topRevenueItems = [...rankedItems]
    .sort((left, right) => right.revenue - left.revenue || right.quantity - left.quantity)
    .slice(0, 5);
  const peakHours = Array.from(orderHourMap.values()).sort((left, right) => right.orders - left.orders || left.hour - right.hour);
  const busiestHour = peakHours[0] || null;
  const hourlyTrend = Array.from(orderHourMap.values())
    .sort((left, right) => left.hour - right.hour)
    .map((entry) => ({
      ...entry,
      revenue: roundMetric(entry.revenue),
    }));
  const dailyTrend = Array.from(dailyRevenueMap.values())
    .sort((left, right) => left.sortKey - right.sortKey)
    .map(({ sortKey, revenue, ...entry }) => ({
      ...entry,
      revenue: roundMetric(revenue),
    }));
  const orderTypeMix = [
    { name: 'Dine-In', value: orderTypeCounts.dineIn },
    { name: 'Takeaway', value: orderTypeCounts.takeaway },
  ].filter((entry) => entry.value > 0);
  const paymentMix = Array.from(paymentMethodMap.values()).sort((left, right) => right.value - left.value);

  const comparisonRange = (() => {
    if (!dateRange.start || !dateRange.end) {
      return null;
    }

    const start = new Date(`${dateRange.start}T00:00:00`);
    const end = new Date(`${dateRange.end}T23:59:59`);
    const durationMs = Math.max(24 * 60 * 60 * 1000, end.getTime() - start.getTime() + 1);
    const previousStart = new Date(start.getTime() - durationMs);
    const previousEnd = new Date(end.getTime() - durationMs);

    return {
      start: formatLocalDateInputValue(previousStart),
      end: formatLocalDateInputValue(previousEnd),
    };
  })();

  const previousOrders = comparisonRange
    ? filterOrdersByType(filterOrdersByDateRange(orders, comparisonRange), orderType)
    : [];
  const previousSettledOrders = previousOrders.filter((order) => isSettledAnalyticsOrder(order));
  const previousRevenue = roundMetric(previousSettledOrders.reduce((sum, order) => sum + getOrderTotal(order), 0));
  const previousTotalOrders = previousOrders.length;

  return {
    filteredOrders,
    settledOrders,
    activeOrders,
    totalOrders,
    totalRevenue,
    totalDiscounts,
    netSales,
    averageOrderValue,
    cancelledOrdersCount,
    openOrdersCount,
    activeOrdersCount: activeOrders.length,
    dailyTrend,
    hourlyTrend,
    topItems,
    lowPerformingItems,
    topRevenueItems,
    busiestHour,
    bestSellingItem: topItems[0] || null,
    orderTypeCounts,
    orderTypeMix,
    paymentMix,
    orderSummary: {
      settled: settledOrders.length,
      open: openOrdersCount,
      cancelled: cancelledOrdersCount,
      itemsServed: filteredOrders.reduce((sum, order) => sum + getOrderItemsCount(order), 0),
    },
    operationalMetrics: {
      averagePreparationMinutes:
        prepDurations.length > 0 ? roundMetric(prepDurations.reduce((sum, value) => sum + value, 0) / prepDurations.length) : 0,
      averageCompletionMinutes:
        completionDurations.length > 0
          ? roundMetric(completionDurations.reduce((sum, value) => sum + value, 0) / completionDurations.length)
          : 0,
      tableTurnover:
        dineInSettledTableIds.size > 0 ? roundMetric(settledOrders.filter((order) => getNormalizedOrderType(order) === 'dine-in').length / dineInSettledTableIds.size) : 0,
    },
    comparison: {
      revenueDelta: roundMetric(totalRevenue - previousRevenue),
      orderDelta: totalOrders - previousTotalOrders,
      previousRevenue,
      previousTotalOrders,
    },
  };
}

export function buildAnalyticsCsv(snapshot) {
  const rows = [
    ['Metric', 'Value'],
    ['Total Orders', snapshot.totalOrders],
    ['Total Revenue', snapshot.totalRevenue.toFixed(2)],
    ['Net Sales', snapshot.netSales.toFixed(2)],
    ['Average Order Value', snapshot.averageOrderValue.toFixed(2)],
    ['Active Orders', snapshot.activeOrdersCount],
    ['Open Orders', snapshot.openOrdersCount],
    ['Cancelled Orders', snapshot.cancelledOrdersCount],
    [],
    ['Top Selling Items'],
    ['Item', 'Quantity', 'Revenue'],
    ...snapshot.topItems.map((item) => [item.name, item.quantity, item.revenue.toFixed(2)]),
    [],
    ['Low Performing Items'],
    ['Item', 'Quantity', 'Revenue'],
    ...snapshot.lowPerformingItems.map((item) => [item.name, item.quantity, item.revenue.toFixed(2)]),
    [],
    ['Top Revenue Items'],
    ['Item', 'Quantity', 'Revenue'],
    ...snapshot.topRevenueItems.map((item) => [item.name, item.quantity, item.revenue.toFixed(2)]),
  ];

  return rows
    .map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n');
}
