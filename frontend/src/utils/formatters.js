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

export const compareTableLabels = (left, right) =>
  String(left || '').localeCompare(String(right || ''), undefined, {
    numeric: true,
    sensitivity: 'base',
  });

export const formatCompactTableLabel = (value, walkInLabel = '#Walk-in') => {
  const normalized = String(value || '').trim();

  if (!normalized) {
    return walkInLabel;
  }

  return /^\d+$/.test(normalized)
    ? `#${normalized.padStart(2, '0')}`
    : `#${normalized}`;
};

const getShortOrderNumber = (order) => {
  const displayValue = order?.displayOrderNumber || '';
  const normalizedDisplayValue = String(displayValue).trim();

  if (/^ORD-\d{8}-\d+$/i.test(normalizedDisplayValue)) {
    const [, numericSuffix = ''] = normalizedDisplayValue.match(/^ORD-\d{8}-(\d+)$/i) || [];
    return `#${numericSuffix.padStart(Math.max(3, numericSuffix.length), '0')}`;
  }

  const numericDisplayValue = normalizedDisplayValue.match(/^#?(\d+)$/);

  if (numericDisplayValue) {
    return `#${String(Number(numericDisplayValue[1])).padStart(2, '0')}`;
  }

  if (order?.id) {
    return `#${String(order.id).slice(-2).toUpperCase()}`;
  }

  return '#--';
};

export const formatDisplayOrderNumber = (order) => getShortOrderNumber(order);

export const formatShortDisplayOrderNumber = (order) => getShortOrderNumber(order);
