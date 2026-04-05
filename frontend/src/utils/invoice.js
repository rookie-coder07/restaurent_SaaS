const DEFAULT_CGST_RATE = 2.5;
const DEFAULT_SGST_RATE = 2.5;

const roundCurrency = (value) => Number(Number(value || 0).toFixed(2));

export const getRestaurantBillingSettings = (restaurant = {}) => {
  const gstEnabled = restaurant?.enableGST !== false;
  const fallbackTotalRate = Number(restaurant?.defaultGSTPercent ?? (DEFAULT_CGST_RATE + DEFAULT_SGST_RATE));
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
  const normalizedCgstRate = roundCurrency(
    cgstRate !== null && cgstRate !== undefined
      ? cgstRate
      : normalizedGstPercent !== null
        ? normalizedGstPercent / 2
        : DEFAULT_CGST_RATE
  );
  const normalizedSgstRate = roundCurrency(
    sgstRate !== null && sgstRate !== undefined
      ? sgstRate
      : normalizedGstPercent !== null
        ? normalizedGstPercent / 2
        : DEFAULT_SGST_RATE
  );
  const cgstAmount = roundCurrency((taxableAmount * normalizedCgstRate) / 100);
  const sgstAmount = roundCurrency((taxableAmount * normalizedSgstRate) / 100);
  const normalizedPackingCharge = roundCurrency(packingCharge);
  const normalizedServiceCharge = roundCurrency(serviceCharge);
  const normalizedDeliveryCharge = roundCurrency(deliveryCharge);
  const chargesTotal = roundCurrency(
    normalizedPackingCharge + normalizedServiceCharge + normalizedDeliveryCharge
  );
  const grossTotal = roundCurrency(taxableAmount + cgstAmount + sgstAmount + chargesTotal);
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
    gstPercent: roundCurrency(normalizedCgstRate + normalizedSgstRate),
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

  const items = Array.isArray(order.items) ? order.items : [];
  const subtotalFromItems = roundCurrency(
    items.reduce(
      (sum, item) => sum + Number(item.quantity || item.qty || 0) * Number(item.unitPrice ?? item.price ?? 0),
      0
    )
  );
  const restaurantSettings = getRestaurantBillingSettings(restaurant);
  const billing = billingOverride || order.billing || order.settlement?.billing || {};
  const computedSummary = calculateInvoiceSummary({
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

  return {
    restaurantName: restaurant?.name || order?.restaurantName || 'Restaurant',
    address: restaurant?.address || '',
    phone: restaurant?.phone || '',
    gstin: restaurant?.gstNumber || '',
    fssai: restaurant?.fssai || '',
    invoiceNumber: billing.invoiceNumber || `INV-${String(order.id || '').slice(-6).toUpperCase()}`,
    invoiceDate,
    orderType: order.orderType || (order.tableId ? 'dine-in' : 'takeaway'),
    tableNumber: order.tableNumber || '',
    cashierName: billing.cashierName || cashierName || '',
    paymentMode: billing.paymentMode || order.paymentMethod || '',
    paidAmount:
      billing.paidAmount ||
      order.settlement?.amountReceived ||
      computedSummary.grandTotal,
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
};

export const printInvoice = (invoice) => {
  if (!invoice || typeof window === 'undefined') {
    return false;
  }

  window.print();
  return true;
};
