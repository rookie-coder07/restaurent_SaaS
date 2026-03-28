export const formatCurrency = (amount, currency = 'INR') => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
};

export const parseServerDate = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/.test(trimmedValue);
    const isoLikeWithoutTimezone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(trimmedValue);
    const parsedDate = new Date(
      !hasTimezone && isoLikeWithoutTimezone ? `${trimmedValue}Z` : trimmedValue
    );

    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

export const formatDate = (date) => {
  const parsedDate = parseServerDate(date);
  if (!parsedDate) {
    return '-';
  }

  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsedDate);
};

export const formatTime = (date) => {
  const parsedDate = parseServerDate(date);
  if (!parsedDate) {
    return '-';
  }

  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(parsedDate);
};

export const formatDisplayOrderNumber = (order) => {
  if (order?.displayOrderNumber) {
    return order.displayOrderNumber;
  }

  if (order?.id) {
    return `ORD-${String(order.id).slice(-6).toUpperCase()}`;
  }

  return 'ORD-UNKNOWN';
};

export const formatShortDisplayOrderNumber = (order) => {
  const displayValue = order?.displayOrderNumber || '';
  const sequenceMatch = displayValue.match(/-(\d+)$/);

  if (sequenceMatch) {
    return `#${String(Number(sequenceMatch[1])).padStart(2, '0')}`;
  }

  if (order?.id) {
    return `#${String(order.id).slice(-2).toUpperCase()}`;
  }

  return '#--';
};
