const DEFAULT_CGST_RATE = 2.5;
const DEFAULT_SGST_RATE = 2.5;
const invoiceBuildCache = new Map();

const roundCurrency = (value) => Number(Number(value || 0).toFixed(2));

function getStoredInvoiceSummary(billing = {}) {
  const subtotal = Number(billing.subtotal ?? 0);
  const grandTotal = Number(billing.grandTotal ?? 0);
  const taxableAmount = Number(billing.taxableAmount ?? 0);
  const cgstAmount = Number(billing.cgstAmount ?? 0);
  const sgstAmount = Number(billing.sgstAmount ?? 0);

  if (subtotal <= 0 || grandTotal <= 0) {
    return null;
  }

  return {
    subtotal: roundCurrency(subtotal),
    orderDiscountAmount: roundCurrency(billing.orderDiscountAmount ?? 0),
    managerDiscountPercent: roundCurrency(billing.managerDiscountPercent ?? 0),
    managerDiscountAmount: roundCurrency(billing.managerDiscountAmount ?? 0),
    taxableAmount: roundCurrency(taxableAmount || subtotal),
    gstPercent: roundCurrency(billing.gstPercent ?? Number(billing.cgstRate ?? 0) + Number(billing.sgstRate ?? 0)),
    cgstRate: roundCurrency(billing.cgstRate ?? 0),
    sgstRate: roundCurrency(billing.sgstRate ?? 0),
    cgstAmount: roundCurrency(cgstAmount),
    sgstAmount: roundCurrency(sgstAmount),
    packingCharge: roundCurrency(billing.packingCharge ?? 0),
    serviceCharge: roundCurrency(billing.serviceCharge ?? 0),
    deliveryCharge: roundCurrency(billing.deliveryCharge ?? 0),
    chargesTotal: roundCurrency(
      Number(billing.packingCharge ?? 0) +
      Number(billing.serviceCharge ?? 0) +
      Number(billing.deliveryCharge ?? 0)
    ),
    loyaltyRedeemedAmount: roundCurrency(billing.loyaltyRedeemedAmount ?? 0),
    payableBeforeRound: roundCurrency(billing.payableBeforeRound ?? grandTotal),
    roundOff: roundCurrency(billing.roundOff ?? 0),
    grandTotal: roundCurrency(grandTotal),
  };
}

export const getRestaurantBillingSettings = (restaurant = {}) => {
  const gstEnabled = restaurant?.enableGST !== false && Number(restaurant?.defaultGSTPercent ?? 5) > 0;
  const fallbackTotalRate = gstEnabled ? Number(restaurant?.defaultGSTPercent ?? (DEFAULT_CGST_RATE + DEFAULT_SGST_RATE)) : 0;
  const cgstRate = gstEnabled
    ? Number(restaurant?.defaultCGSTPercent ?? fallbackTotalRate / 2)
    : 0;
  const sgstRate = gstEnabled
    ? Number(restaurant?.defaultSGSTPercent ?? fallbackTotalRate / 2)
    : 0;
  const gstPercent = gstEnabled ? cgstRate + sgstRate : 0;

  return {
    gstEnabled,
    gstPercent: roundCurrency(gstPercent),
    cgstRate: roundCurrency(cgstRate),
    sgstRate: roundCurrency(sgstRate),
  };
};

export const calculateInvoiceSummary = ({
  subtotal = 0,
  orderDiscountAmount = 0,
  managerDiscountPercent = 0,
  loyaltyRedeemedAmount = 0,
  packingCharge = 0,
  serviceCharge = 0,
  deliveryCharge = 0,
  gstPercent,
  cgstRate = null,
  sgstRate = null,
} = {}) => {
  const normalizedSubtotal = roundCurrency(subtotal);
  const normalizedOrderDiscount = roundCurrency(orderDiscountAmount);
  const discountedSubtotal = Math.max(0, roundCurrency(normalizedSubtotal - normalizedOrderDiscount));
  const normalizedManagerDiscountPercent = Math.max(0, Number(managerDiscountPercent || 0));
  const managerDiscountAmount = roundCurrency((discountedSubtotal * normalizedManagerDiscountPercent) / 100);
  const taxableAmount = Math.max(0, roundCurrency(discountedSubtotal - managerDiscountAmount));
  const normalizedGstPercent = gstPercent !== undefined && gstPercent !== null
    ? Number(gstPercent || 0)
    : null;
  const normalizedCgstRate = normalizedGstPercent === 0 ? 0 : roundCurrency(
    cgstRate !== null && cgstRate !== undefined
      ? cgstRate
      : normalizedGstPercent !== null
        ? normalizedGstPercent / 2
        : DEFAULT_CGST_RATE
  );
  const normalizedSgstRate = normalizedGstPercent === 0 ? 0 : roundCurrency(
    sgstRate !== null && sgstRate !== undefined
      ? sgstRate
      : normalizedGstPercent !== null
        ? normalizedGstPercent / 2
        : DEFAULT_SGST_RATE
  );
  const cgstAmount = normalizedCgstRate > 0 ? roundCurrency((taxableAmount * normalizedCgstRate) / 100) : 0;
  const sgstAmount = normalizedSgstRate > 0 ? roundCurrency((taxableAmount * normalizedSgstRate) / 100) : 0;
  const normalizedPackingCharge = roundCurrency(packingCharge);
  const normalizedServiceCharge = roundCurrency(serviceCharge);
  const normalizedDeliveryCharge = roundCurrency(deliveryCharge);
  const chargesTotal = roundCurrency(
    normalizedPackingCharge + normalizedServiceCharge + normalizedDeliveryCharge
  );
  const totalTax = normalizedCgstRate > 0 || normalizedSgstRate > 0 ? cgstAmount + sgstAmount : 0;
  const grossTotal = roundCurrency(taxableAmount + totalTax + chargesTotal);
  const normalizedLoyaltyRedeemed = Math.min(roundCurrency(loyaltyRedeemedAmount), grossTotal);
  const payableBeforeRound = roundCurrency(grossTotal - normalizedLoyaltyRedeemed);
  const grandTotal = Math.round(payableBeforeRound);
  const roundOff = roundCurrency(grandTotal - payableBeforeRound);

  return {
    subtotal: normalizedSubtotal,
    orderDiscountAmount: normalizedOrderDiscount,
    managerDiscountPercent: normalizedManagerDiscountPercent,
    managerDiscountAmount,
    taxableAmount,
    gstPercent: normalizedCgstRate + normalizedSgstRate > 0 ? roundCurrency(normalizedCgstRate + normalizedSgstRate) : 0,
    cgstRate: normalizedCgstRate,
    sgstRate: normalizedSgstRate,
    cgstAmount,
    sgstAmount,
    packingCharge: normalizedPackingCharge,
    serviceCharge: normalizedServiceCharge,
    deliveryCharge: normalizedDeliveryCharge,
    chargesTotal,
    loyaltyRedeemedAmount: normalizedLoyaltyRedeemed,
    payableBeforeRound,
    roundOff,
    grandTotal: roundCurrency(grandTotal),
  };
};

export const buildInvoiceData = ({
  order,
  restaurant = {},
  cashierName = '',
  billingOverride = null,
} = {}) => {
  if (!order) {
    return null;
  }

  const cacheKey = [
    order.id || '',
    order.updatedAt || order.createdAt || '',
    order.invoiceNumber || '',
    order.paymentStatus || '',
    cashierName || '',
  ].join('|');
  const cachedInvoice = invoiceBuildCache.get(cacheKey);
  if (cachedInvoice) {
    return cachedInvoice;
  }

  const items = Array.isArray(order.items) ? order.items : Array.isArray(order.orderItems) ? order.orderItems : [];
  const subtotalFromItems = roundCurrency(
    items.reduce(
      (sum, item) => sum + Number(item.quantity || item.qty || 0) * Number(item.unitPrice ?? item.price ?? 0),
      0
    )
  );
  const restaurantSettings = getRestaurantBillingSettings(restaurant);
  const billing = billingOverride || order.billing || order.settlement?.billing || {};
  const storedSummary = getStoredInvoiceSummary(billing);
  const computedSummary = storedSummary || calculateInvoiceSummary({
    subtotal: billing.subtotal || subtotalFromItems,
    orderDiscountAmount:
      billing.orderDiscountAmount ?? Math.max(0, roundCurrency(subtotalFromItems - Number(order.totalAmount || 0))),
    managerDiscountPercent: billing.managerDiscountPercent || 0,
    loyaltyRedeemedAmount:
      billing.loyaltyRedeemedAmount ?? order.settlement?.loyalty?.redeemedAmount ?? order.loyalty?.redeemedAmount ?? 0,
    packingCharge: billing.packingCharge || 0,
    serviceCharge: billing.serviceCharge || 0,
    deliveryCharge: billing.deliveryCharge || 0,
    gstPercent: billing.gstPercent,
    cgstRate:
      billing.cgstRate !== undefined && billing.cgstRate !== null
        ? billing.cgstRate
        : restaurantSettings.cgstRate,
    sgstRate:
      billing.sgstRate !== undefined && billing.sgstRate !== null
        ? billing.sgstRate
        : restaurantSettings.sgstRate,
  });

  const createdAt = order.updatedAt || order.createdAt || new Date().toISOString();
  const invoiceDate = billing.invoiceDate || createdAt;
  const paymentStatus = String(order.paymentStatus || billing.paymentStatus || '').toLowerCase();
  const settlementAmount = Number(order.settlement?.amountReceived || 0);
  const billingAmount = Number(billing?.paidAmount || 0);
  const paidAmount =
    paymentStatus === 'paid'
      ? (
        settlementAmount > 0 ? settlementAmount :
        billingAmount > 0 ? billingAmount :
        computedSummary.grandTotal
      )
      : 0;

  const invoiceData = {
    restaurantName: restaurant?.name || order?.restaurantName || 'Restaurant',
    address: restaurant?.address || '',
    phone: restaurant?.phone || '',
    gstin: restaurant?.gstNumber || '',
    gstAuthority: restaurant?.gstAuthority || '',
    fssai: restaurant?.fssai || '',
    invoiceNumber: order.invoiceNumber || billing.invoiceNumber || '',
    invoiceDate,
    orderType: order.orderType || (order.tableId ? 'dine-in' : 'takeaway'),
    tableNumber: order.tableNumber || '',
    cashierName: billing.cashierName || cashierName || '',
    paymentMode: billing.paymentMode || order.paymentMethod || '',
    paymentStatus,
    finalAmount: computedSummary.grandTotal,
    paidAmount,
    customerName: order.online?.customerName || '',
    customerPhone: order.online?.customerPhone || order.loyalty?.customerPhone || '',
    kotReference: order.kitchenTickets?.length
      ? `#${order.kitchenTickets[order.kitchenTickets.length - 1]?.sequence || ''}`
      : '',
    items: items.map((item) => ({
      name: item.name || 'Item',
      quantity: Number(item.quantity || item.qty || 0),
      price: roundCurrency(item.unitPrice ?? item.price ?? 0),
      total: roundCurrency(Number(item.quantity || item.qty || 0) * Number(item.unitPrice ?? item.price ?? 0)),
    })),
    summary: computedSummary,
  };

  if (invoiceBuildCache.size > 100) {
    const oldestKey = invoiceBuildCache.keys().next().value;
    if (oldestKey) {
      invoiceBuildCache.delete(oldestKey);
    }
  }

  invoiceBuildCache.set(cacheKey, invoiceData);
  return invoiceData;
};

export const printInvoice = (invoice) => {
  if (!invoice || typeof window === 'undefined') {
    return false;
  }

  window.print();
  return true;
};
