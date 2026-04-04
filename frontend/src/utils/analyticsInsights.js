import { parseServerDate } from './formatters';

export function isSettledAnalyticsOrder(order) {
  return order?.status === 'completed' || String(order?.paymentStatus || '').toLowerCase() === 'paid';
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
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

export function filterOrdersByDateRange(orders = [], dateRange = {}) {
  return orders.filter((order) => {
    const createdAt = parseServerDate(order.createdAt);
    if (!createdAt) {
      return false;
    }

    const startMatch = !dateRange.start || createdAt >= new Date(`${dateRange.start}T00:00:00`);
    const endMatch = !dateRange.end || createdAt <= new Date(`${dateRange.end}T23:59:59`);
    return startMatch && endMatch;
  });
}

function getHourLabel(hour) {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const twelveHour = hour % 12 || 12;
  return `${twelveHour}:00 ${suffix}`;
}

export function buildAnalyticsSnapshot(orders = [], dateRange = {}) {
  const filteredOrders = filterOrdersByDateRange(orders, dateRange);
  const settledOrders = filteredOrders.filter((order) => isSettledAnalyticsOrder(order));
  const totalOrders = filteredOrders.length;
  const totalRevenue = settledOrders.reduce((sum, order) => sum + Number(order.totalAmount || order.total || 0), 0);
  const totalDiscounts = settledOrders.reduce((sum, order) => sum + parseDiscountAmountFromNotes(order.notes), 0);
  const averageOrderValue = settledOrders.length > 0 ? totalRevenue / settledOrders.length : 0;
  const discountedOrders = settledOrders.filter((order) => parseDiscountAmountFromNotes(order.notes) > 0);

  const dailyMap = new Map();
  const peakHourMap = new Map();
  const itemMap = new Map();

  filteredOrders.forEach((order) => {
    const createdAt = parseServerDate(order.createdAt);
    if (!createdAt) {
      return;
    }

    const dayLabel = new Intl.DateTimeFormat('en-IN', {
      month: 'short',
      day: 'numeric',
    }).format(createdAt);
    const currentDay = dailyMap.get(dayLabel) || {
      date: dayLabel,
      orders: 0,
      revenue: 0,
      discounts: 0,
    };
    currentDay.orders += 1;
    currentDay.revenue += Number(order.totalAmount || order.total || 0);
    currentDay.discounts += parseDiscountAmountFromNotes(order.notes);
    dailyMap.set(dayLabel, currentDay);

    const orderHour = createdAt.getHours();
    const currentHour = peakHourMap.get(orderHour) || {
      hour: orderHour,
      label: getHourLabel(orderHour),
      orders: 0,
      revenue: 0,
    };
    currentHour.orders += 1;
    currentHour.revenue += Number(order.totalAmount || order.total || 0);
    peakHourMap.set(orderHour, currentHour);

    (order.items || []).forEach((item) => {
      const itemName = item.name || 'Unknown item';
      const currentItem = itemMap.get(itemName) || {
        name: itemName,
        quantity: 0,
        revenue: 0,
      };
      const quantity = Number(item.quantity || 0);
      currentItem.quantity += quantity;
      currentItem.revenue += Number(item.price || item.unitPrice || 0) * quantity;
      itemMap.set(itemName, currentItem);
    });
  });

  const rankedItems = Array.from(itemMap.values()).sort(
    (left, right) => right.quantity - left.quantity || right.revenue - left.revenue
  );
  const topItems = rankedItems.slice(0, 5);
  const lowPerformingItems = rankedItems
    .filter((item) => item.quantity > 0)
    .sort((left, right) => left.quantity - right.quantity || left.revenue - right.revenue)
    .slice(0, 5);
  const peakHours = Array.from(peakHourMap.values()).sort(
    (left, right) => right.orders - left.orders || right.revenue - left.revenue
  );

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
      start: previousStart.toISOString().split('T')[0],
      end: previousEnd.toISOString().split('T')[0],
    };
  })();

  const previousOrders = comparisonRange ? filterOrdersByDateRange(orders, comparisonRange) : [];
  const previousSettledOrders = previousOrders.filter((order) => isSettledAnalyticsOrder(order));
  const previousRevenue = previousSettledOrders.reduce((sum, order) => sum + Number(order.totalAmount || order.total || 0), 0);
  const previousTotalOrders = previousOrders.length;

  const statusData = [
    { name: 'Settled', value: settledOrders.length, color: '#10B981' },
    { name: 'Pending', value: filteredOrders.filter((order) => order.status === 'pending').length, color: '#F59E0B' },
    { name: 'Preparing', value: filteredOrders.filter((order) => order.status === 'preparing').length, color: '#3B82F6' },
    { name: 'Ready', value: filteredOrders.filter((order) => order.status === 'ready').length, color: '#8B5CF6' },
    { name: 'Served', value: filteredOrders.filter((order) => order.status === 'served').length, color: '#64748B' },
    { name: 'Cancelled', value: filteredOrders.filter((order) => order.status === 'cancelled').length, color: '#EF4444' },
  ].filter((entry) => entry.value > 0);

  return {
    filteredOrders,
    settledOrders,
    totalOrders,
    totalRevenue,
    totalDiscounts,
    averageOrderValue,
    discountedOrdersCount: discountedOrders.length,
    dailyTrend: Array.from(dailyMap.values()),
    peakHours,
    topItems,
    lowPerformingItems,
    statusData,
    comparison: {
      revenueDelta: totalRevenue - previousRevenue,
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
    ['Average Order Value', snapshot.averageOrderValue.toFixed(2)],
    ['Total Discounts', snapshot.totalDiscounts.toFixed(2)],
    ['Discounted Orders', snapshot.discountedOrdersCount],
    ['Revenue Delta', snapshot.comparison.revenueDelta.toFixed(2)],
    ['Order Delta', snapshot.comparison.orderDelta],
    [],
    ['Top Items'],
    ['Item', 'Quantity', 'Revenue'],
    ...snapshot.topItems.map((item) => [item.name, item.quantity, item.revenue.toFixed(2)]),
    [],
    ['Low Performing Items'],
    ['Item', 'Quantity', 'Revenue'],
    ...snapshot.lowPerformingItems.map((item) => [item.name, item.quantity, item.revenue.toFixed(2)]),
  ];

  return rows
    .map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n');
}
