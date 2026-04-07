import { BadgePercent, BellRing, Loader, Receipt, RefreshCw, Wallet } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import useAutoRefresh from '../hooks/useAutoRefresh';
import { menuAPI, orderAPI, restaurantAPI } from '../services/apiEndpoints';
import { useAuthStore } from '../context/authStore';
import { useManagerStore } from '../context/managerStore';
import { formatCurrency, formatDate, formatDisplayOrderNumber } from '../utils/formatters';
import { buildInvoiceData, calculateInvoiceSummary, getRestaurantBillingSettings } from '../utils/invoice';
import { isUnpaid } from '../utils/managerPortal';
import { playLoudBuzzer } from '../utils/alerts';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import Toast from '../components/common/Toast';
import MenuPanel from '../components/pos/MenuPanel';

function normalizeId(value) {
  return value?.id || value?._id || value || '';
}

function normalizeCategory(category) {
  return {
    id: normalizeId(category),
    name: category?.name || 'Uncategorized',
  };
}

function normalizeMenuItem(item) {
  return {
    id: normalizeId(item),
    name: item?.name || 'Untitled item',
    description: item?.description || '',
    price: Number(item?.unitPrice ?? item?.unit_price ?? item?.price ?? 0),
    categoryId: item?.categoryId || item?.category_id || item?.category?.id || item?.category?._id || '',
    isAvailable: item?.isAvailable !== false && item?.status !== 'inactive',
  };
}

function getBillSummary(
  order,
  {
    managerDiscountPercent = 0,
    billingSettings = null,
    defaultServiceCharge = 0,
  } = {}
) {
  const billing = order?.billing || order?.settlement?.billing || {};
  const settlement = order?.settlement || {};
  const itemSubtotal = Number(
    ((order?.items || order?.orderItems || []).reduce(
      (sum, item) => sum + Number(item.quantity || item.qty || 0) * Number(item.unitPrice ?? item.price ?? 0),
      0
    )).toFixed(2)
  );
  const storedGrandTotal = Number(billing.grandTotal ?? settlement.finalTotal ?? 0);
  const fallbackGrandTotal = Number(order?.totalAmount ?? order?.total ?? itemSubtotal ?? 0);
  const hasComputedInputs =
    itemSubtotal > 0 ||
    Number(billing.subtotal || 0) > 0 ||
    Number(billing.orderDiscountAmount || 0) > 0 ||
    Number(managerDiscountPercent || 0) > 0 ||
    Number(billing.serviceCharge ?? defaultServiceCharge ?? 0) > 0;
  const computedSummary = hasComputedInputs
    ? calculateInvoiceSummary({
        subtotal: Number(billing.subtotal || itemSubtotal || fallbackGrandTotal || 0),
        orderDiscountAmount: Number(
          billing.orderDiscountAmount ??
            Math.max(0, Number(((itemSubtotal || 0) - Number(order?.totalAmount ?? order?.total ?? itemSubtotal ?? 0)).toFixed(2)))
        ),
        managerDiscountPercent,
        loyaltyRedeemedAmount:
          billing.loyaltyRedeemedAmount ??
          order?.settlement?.loyalty?.redeemedAmount ??
          order?.loyalty?.redeemedAmount ??
          0,
        packingCharge: Number(billing.packingCharge || 0),
        serviceCharge: Number(billing.serviceCharge ?? defaultServiceCharge ?? 0),
        deliveryCharge: Number(billing.deliveryCharge || 0),
        cgstRate:
          billing.cgstRate !== undefined && billing.cgstRate !== null
            ? Number(billing.cgstRate)
            : Number(billingSettings?.cgstRate || 0),
        sgstRate:
          billing.sgstRate !== undefined && billing.sgstRate !== null
            ? Number(billing.sgstRate)
            : Number(billingSettings?.sgstRate || 0),
      })
    : null;
  const grandTotal =
    storedGrandTotal > 0
      ? storedGrandTotal
      : Number(computedSummary?.grandTotal ?? fallbackGrandTotal);
  const paidAmount = Number(
    Number(billing.paidAmount ?? settlement.amountReceived ?? 0) > 0
      ? Number(billing.paidAmount ?? settlement.amountReceived ?? 0)
      : (String(order?.paymentStatus || '').toLowerCase() === 'paid' ? grandTotal : 0)
  );

  return {
    grandTotal,
    paidAmount,
    dueAmount: Math.max(0, Number((grandTotal - Math.min(grandTotal, paidAmount)).toFixed(2))),
    paymentMethod: String(billing.paymentMode || order?.paymentMethod || 'cash').toLowerCase(),
    paymentStatus: String(order?.paymentStatus || 'pending').toLowerCase(),
  };
}

function normalizePhoneForDisplay(value) {
  const digits = String(value || '').replace(/[^\d]/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export default function ManagerBills() {
  const navigate = useNavigate();
  const { data: ordersData = {}, loading, execute: reloadOrders, refetch: refetchOrders } = useApi(() =>
    orderAPI.getOrders({ limit: 150 })
  );
  const { data: menuData = {} } = useApi(() => menuAPI.getItems({ limit: 300 }));
  const { data: categoriesData = {} } = useApi(menuAPI.getCategories);
  const { data: restaurantProfile = {}, refetch: refetchProfile } = useApi(restaurantAPI.getProfile);
  const user = useAuthStore((state) => state.user);
  const approvedDiscounts = useManagerStore((state) => state.approvedDiscounts);
  const approveDiscount = useManagerStore((state) => state.approveDiscount);
  const [selectedBill, setSelectedBill] = useState(null);
  const [payingBill, setPayingBill] = useState(null);
  const [discountPercent, setDiscountPercent] = useState('');
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [loyaltyPhone, setLoyaltyPhone] = useState('');
  const [loyaltyProfile, setLoyaltyProfile] = useState(null);
  const [redeemPoints, setRedeemPoints] = useState('');
  const [isCheckingLoyalty, setIsCheckingLoyalty] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [managerAlertMessage, setManagerAlertMessage] = useState('');
  const [actioningBillId, setActioningBillId] = useState('');
  const [editingBill, setEditingBill] = useState(null);
  const [editingItems, setEditingItems] = useState([]);
  const [editSearchTerm, setEditSearchTerm] = useState('');
  const [editActiveCategory, setEditActiveCategory] = useState('all');
  const hasPrimedAlertsRef = useRef(false);
  const previousUnpaidIdsRef = useRef(new Set());

  useAutoRefresh(() => Promise.allSettled([refetchOrders(), refetchProfile()]), 12000);

  const fetchFreshBill = async (bill) => {
    if (!bill?.id) {
      return bill;
    }

    const response = await orderAPI.getOrder(bill.id);
    return response.data?.data || bill;
  };

  const bills = useMemo(
    () => (ordersData?.items || []).filter((order) => order?.status !== 'cancelled'),
    [ordersData?.items]
  );
  const menuItems = useMemo(
    () => (menuData?.items || []).map(normalizeMenuItem).filter((item) => item.isAvailable),
    [menuData]
  );
  const numericServiceCharge = Math.max(0, Number(restaurantProfile?.defaultServiceCharge || 0));
  const restaurantBillingSettings = useMemo(
    () => getRestaurantBillingSettings(restaurantProfile),
    [restaurantProfile]
  );
  const editCategories = useMemo(() => {
    const normalizedCategories = (categoriesData?.categories || []).map(normalizeCategory);
    const query = String(editSearchTerm || '').trim().toLowerCase();
    const searchedItems = !query
      ? menuItems
      : menuItems.filter((item) =>
          [item.name, item.description]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query))
        );

    const groupedItems = normalizedCategories
      .map((category) => ({
        ...category,
        items: searchedItems.filter((item) => String(item.categoryId || '') === String(category.id)),
      }))
      .filter((category) => category.items.length > 0);

    const uncategorizedItems = searchedItems.filter(
      (item) => !groupedItems.some((category) => category.items.some((categoryItem) => categoryItem.id === item.id))
    );

    const groups = [{ id: 'all', name: 'All', items: searchedItems }, ...groupedItems];

    if (uncategorizedItems.length > 0) {
      groups.push({ id: 'uncategorized', name: 'Uncategorized', items: uncategorizedItems });
    }

    return groups;
  }, [categoriesData, editSearchTerm, menuItems]);
  const unpaidBills = useMemo(() => bills.filter(isUnpaid), [bills]);
  const pendingAmount = useMemo(
    () =>
      unpaidBills.reduce((sum, order) => {
        const approval = order?.approvedDiscount || (order?.id ? approvedDiscounts[order.id] : null);
        return (
          sum +
          getBillSummary(order, {
            managerDiscountPercent: approval?.percent || 0,
            billingSettings: restaurantBillingSettings,
            defaultServiceCharge: numericServiceCharge,
          }).dueAmount
        );
      }, 0),
    [approvedDiscounts, numericServiceCharge, restaurantBillingSettings, unpaidBills]
  );
  const orderedBills = useMemo(
    () =>
      [...bills].sort((left, right) => {
        const leftUnpaid = isUnpaid(left) ? 0 : 1;
        const rightUnpaid = isUnpaid(right) ? 0 : 1;
        if (leftUnpaid !== rightUnpaid) {
          return leftUnpaid - rightUnpaid;
        }

        return new Date(right?.createdAt || 0) - new Date(left?.createdAt || 0);
      }),
    [bills]
  );
  const activeApproval = payingBill?.approvedDiscount || (payingBill?.id ? approvedDiscounts[payingBill.id] : null);
  const activeBillSummary = getBillSummary(payingBill, {
    managerDiscountPercent: activeApproval?.percent || 0,
    billingSettings: restaurantBillingSettings,
    defaultServiceCharge: numericServiceCharge,
  });
  const activeBilling = payingBill?.billing || payingBill?.settlement?.billing || {};
  const subtotalFromItems = useMemo(
    () =>
      Number(
        (((payingBill?.items || payingBill?.orderItems || [])).reduce(
          (sum, item) => sum + Number(item.quantity || item.qty || 0) * Number(item.unitPrice ?? item.price ?? 0),
          0
        )).toFixed(2)
      ),
    [payingBill]
  );
  const previewSubtotal = Number(activeBilling.subtotal || subtotalFromItems || payingBill?.totalAmount || payingBill?.total || 0);
  const previewOrderDiscountAmount = Math.max(
    0,
    Number(
      (
        activeBilling.orderDiscountAmount ??
        Math.max(0, previewSubtotal - Number(payingBill?.totalAmount || payingBill?.total || 0))
      ).toFixed(2)
    )
  );
  const previewSummaryBeforeLoyalty = useMemo(
    () =>
      calculateInvoiceSummary({
        subtotal: previewSubtotal,
        orderDiscountAmount: previewOrderDiscountAmount,
        managerDiscountPercent: activeApproval?.percent || 0,
        loyaltyRedeemedAmount: 0,
        packingCharge: Number(activeBilling.packingCharge || 0),
        serviceCharge: numericServiceCharge,
        deliveryCharge: Number(activeBilling.deliveryCharge || 0),
        cgstRate: restaurantBillingSettings.cgstRate,
        sgstRate: restaurantBillingSettings.sgstRate,
      }),
    [activeApproval?.percent, activeBilling.deliveryCharge, activeBilling.packingCharge, numericServiceCharge, previewOrderDiscountAmount, previewSubtotal, restaurantBillingSettings]
  );
  const numericAmountReceived = Number(amountReceived || 0);
  const loyaltyRedeemPreview = useMemo(() => {
    const requestedPoints = Math.max(0, Math.floor(Number(redeemPoints || 0)));
    const availablePoints = Math.max(0, Number(loyaltyProfile?.pointsBalance || 0));
    return Math.min(requestedPoints, availablePoints, Math.floor(previewSummaryBeforeLoyalty.grandTotal));
  }, [loyaltyProfile?.pointsBalance, previewSummaryBeforeLoyalty.grandTotal, redeemPoints]);
  const previewSummary = useMemo(
    () =>
      calculateInvoiceSummary({
        subtotal: previewSubtotal,
        orderDiscountAmount: previewOrderDiscountAmount,
        managerDiscountPercent: activeApproval?.percent || 0,
        loyaltyRedeemedAmount: loyaltyRedeemPreview,
        packingCharge: Number(activeBilling.packingCharge || 0),
        serviceCharge: numericServiceCharge,
        deliveryCharge: Number(activeBilling.deliveryCharge || 0),
        cgstRate: restaurantBillingSettings.cgstRate,
        sgstRate: restaurantBillingSettings.sgstRate,
      }),
    [activeApproval?.percent, activeBilling.deliveryCharge, activeBilling.packingCharge, loyaltyRedeemPreview, numericServiceCharge, previewOrderDiscountAmount, previewSubtotal, restaurantBillingSettings]
  );
  const billTotalWithServiceCharge = Number(previewSummaryBeforeLoyalty.grandTotal || activeBillSummary.grandTotal || 0);
  const payableAfterLoyalty = Number(previewSummary.grandTotal || billTotalWithServiceCharge || 0);
  const paymentGap = Math.max(0, Number((payableAfterLoyalty - numericAmountReceived).toFixed(2)));
  const changeDue = Math.max(0, Number((numericAmountReceived - payableAfterLoyalty).toFixed(2)));
  const editingSubtotal = useMemo(
    () =>
      Number(
        editingItems
          .reduce(
            (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice ?? item.price ?? 0),
            0
          )
          .toFixed(2)
      ),
    [editingItems]
  );
  const editingSummary = useMemo(
    () =>
      calculateInvoiceSummary({
        subtotal: editingSubtotal,
        serviceCharge: numericServiceCharge,
        cgstRate: restaurantBillingSettings.cgstRate,
        sgstRate: restaurantBillingSettings.sgstRate,
      }),
    [editingSubtotal, numericServiceCharge, restaurantBillingSettings]
  );

  useEffect(() => {
    const refreshManagerBills = () => {
      Promise.allSettled([refetchOrders(), refetchProfile()]).catch(() => {
        // Page-level error state already exists.
      });
    };

    const intervalId = window.setInterval(refreshManagerBills, 10000);
    return () => window.clearInterval(intervalId);
  }, [refetchOrders, refetchProfile]);

  useEffect(() => {
    const nextUnpaidIds = new Set(unpaidBills.map((bill) => bill.id).filter(Boolean));

    if (!hasPrimedAlertsRef.current) {
      previousUnpaidIdsRef.current = nextUnpaidIds;
      hasPrimedAlertsRef.current = true;
      return;
    }

    const freshBills = unpaidBills.filter((bill) => bill.id && !previousUnpaidIdsRef.current.has(bill.id));
    previousUnpaidIdsRef.current = nextUnpaidIds;

    if (freshBills.length > 0) {
      playLoudBuzzer('manager');
      setManagerAlertMessage(
        freshBills.length > 1
          ? `${freshBills.length} new bills need manager payment.`
          : `${formatDisplayOrderNumber(freshBills[0])} needs manager payment.`
      );
    }
  }, [unpaidBills]);

  useEffect(() => {
    if (!payingBill) {
      return;
    }

    const freshSummary = getBillSummary(payingBill, {
      managerDiscountPercent: activeApproval?.percent || 0,
      billingSettings: restaurantBillingSettings,
      defaultServiceCharge: numericServiceCharge,
    });
    setAmountReceived(String(freshSummary.grandTotal));
    setLoyaltyPhone('');
    setLoyaltyProfile(null);
    setRedeemPoints('');
  }, [payingBill, paymentMethod]);

  useEffect(() => {
    if (!editCategories.some((category) => category.id === editActiveCategory)) {
      setEditActiveCategory(editCategories[0]?.id || 'all');
    }
  }, [editActiveCategory, editCategories]);

  const handleCheckLoyalty = async () => {
    const phoneToCheck = String(loyaltyPhone || '').trim();
    if (phoneToCheck.length < 10) {
      setError('Enter a valid customer phone number to check loyalty points.');
      return;
    }

    setIsCheckingLoyalty(true);
    setError('');

    try {
      const response = await orderAPI.getLoyaltyProfile(phoneToCheck);
      const profile = response.data?.data || null;
      const resolvedPhone = normalizePhoneForDisplay(profile?.customerPhone || phoneToCheck);
      setLoyaltyProfile(profile);
      setRedeemPoints('');
      setSuccess(
        resolvedPhone
          ? `Loyalty balance loaded for ${resolvedPhone}.`
          : 'No loyalty history found for this number yet.'
      );
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to load loyalty points.');
    } finally {
      setIsCheckingLoyalty(false);
    }
  };

  const submitApproval = () => {
    const percent = Number(discountPercent);
    if (!selectedBill) {
      return;
    }

    if (!percent || percent <= 0) {
      setError('Enter a valid discount percent.');
      return;
    }

    setError('');
    setActioningBillId(selectedBill.id);

    orderAPI.approveDiscount(selectedBill.id, {
      percent,
      note,
    })
      .then(async () => {
        approveDiscount({
          orderId: selectedBill.id,
          percent,
          note,
          approvedBy: user?.name || user?.email || 'Manager',
        });
        await reloadOrders();
        setSuccess(`Discount approved for ${formatDisplayOrderNumber(selectedBill)}.`);
        setSelectedBill(null);
        setDiscountPercent('');
        setNote('');
      })
      .catch((requestError) => {
        setError(requestError.response?.data?.message || 'Failed to approve discount.');
      })
      .finally(() => {
        setActioningBillId('');
      });
  };

  const createBill = async () => {
    if (!payingBill?.id) {
      return;
    }

    const approval = payingBill?.approvedDiscount || approvedDiscounts[payingBill.id];
    setActioningBillId(payingBill.id);
    setError('');

    try {
      const freshBill = await fetchFreshBill(payingBill);
      const receivedAmount = Number(amountReceived || payableAfterLoyalty || 0);

      await orderAPI.settleOrder(payingBill.id, {
        paymentMethod,
        amountReceived: receivedAmount,
        discountPercent: approval?.percent || undefined,
        paymentNote: [approval?.note, note.trim()].filter(Boolean).join(' | '),
        loyaltyPhone: loyaltyPhone.trim(),
        redeemPoints: loyaltyRedeemPreview,
        serviceCharge: numericServiceCharge,
      });

      const refreshedOrder = await orderAPI.getOrder(payingBill.id);
      const settledBill = refreshedOrder.data?.data;
      const invoiceData = buildInvoiceData({
        order: settledBill,
        restaurant: restaurantProfile,
        cashierName: user?.name || user?.email || 'Manager',
      });

      setSuccess(
        approval?.percent
          ? `${formatDisplayOrderNumber(payingBill)} bill created with ${approval.percent}% discount.`
          : `${formatDisplayOrderNumber(payingBill)} bill created and waiting for payment confirmation.`
      );
      setPayingBill(null);
      setAmountReceived('');
      setLoyaltyPhone('');
      setLoyaltyProfile(null);
      setRedeemPoints('');
      setNote('');
      await reloadOrders();
      navigate(`/manager/bills/${settledBill?.id || payingBill.id}`, {
        state: {
          order: settledBill,
          restaurant: restaurantProfile,
          invoice: invoiceData,
          returnTo: '/manager/bills',
          cashierName: user?.name || user?.email || 'Manager',
        },
      });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to create the bill.');
    } finally {
      setActioningBillId('');
    }
  };

  const confirmBillPaid = async (bill) => {
    if (!bill?.id) {
      return;
    }

    setActioningBillId(bill.id);
    setError('');

    try {
      await orderAPI.markOrderPaid(bill.id, {
        paymentMethod: String(bill?.paymentMethod || bill?.billing?.paymentMode || 'cash').toLowerCase(),
      });
      await reloadOrders();
      setSuccess(`${formatDisplayOrderNumber(bill)} marked paid.`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to mark the bill paid.');
    } finally {
      setActioningBillId('');
    }
  };

  const openPayBill = async (bill) => {
    setActioningBillId(bill.id);
    setError('');

    try {
      const freshBill = await fetchFreshBill(bill);
      const approval = freshBill?.approvedDiscount || (freshBill?.id ? approvedDiscounts[freshBill.id] : null);
      const summary = getBillSummary(freshBill, {
        managerDiscountPercent: approval?.percent || 0,
        billingSettings: restaurantBillingSettings,
        defaultServiceCharge: numericServiceCharge,
      });
      setPayingBill(freshBill);
      setPaymentMethod(summary.paymentMethod || 'cash');
      setAmountReceived(String(summary.grandTotal));
      setLoyaltyPhone('');
      setLoyaltyProfile(null);
      setRedeemPoints('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to load the latest bill.');
    } finally {
      setActioningBillId('');
    }
  };

  const openPrintedBill = async (bill) => {
    setActioningBillId(bill.id);
    setError('');

    try {
      const freshBill = await fetchFreshBill(bill);
      navigate(`/manager/bills/${freshBill.id}`, {
        state: {
          order: freshBill,
          restaurant: restaurantProfile,
          invoice: buildInvoiceData({
            order: freshBill,
            restaurant: restaurantProfile,
            cashierName: freshBill.billing?.cashierName || user?.name || user?.email || 'Manager',
          }),
          returnTo: '/manager/bills',
          cashierName: freshBill.billing?.cashierName || user?.name || user?.email || 'Manager',
        },
      });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to load the latest bill details.');
    } finally {
      setActioningBillId('');
    }
  };

  const openEditBill = async (bill) => {
    setActioningBillId(bill.id);
    setError('');

    try {
      const freshBill = await fetchFreshBill(bill);
      setEditingBill(freshBill);
      setEditingItems(
        (freshBill.items || freshBill.orderItems || []).map((item) => ({
          menuItemId: item.menuItemId || item.id,
          quantity: Number(item.quantity || item.qty || 0),
          unitPrice: Number(item.unitPrice ?? item.price ?? 0),
          name: item.name || 'Item',
          itemNote: item.itemNote || item.note || '',
          modifiers: item.modifiers || [],
        }))
      );
      setEditSearchTerm('');
      setEditActiveCategory('all');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to open bill editor.');
    } finally {
      setActioningBillId('');
    }
  };

  const addMenuItemToBillEdit = (menuItemOrId) => {
    const resolvedMenuItem =
      typeof menuItemOrId === 'object' && menuItemOrId !== null
        ? menuItemOrId
        : menuItems.find((item) => String(item.id) === String(menuItemOrId));

    if (!resolvedMenuItem?.id) {
      return;
    }

    setEditingItems((current) => {
      const existing = current.find((item) => String(item.menuItemId) === String(resolvedMenuItem.id));
      if (existing) {
        return current.map((item) =>
          String(item.menuItemId) === String(resolvedMenuItem.id)
            ? { ...item, quantity: Number(item.quantity || 0) + 1 }
            : item
        );
      }

      return [
        ...current,
        {
          menuItemId: resolvedMenuItem.id,
          quantity: 1,
          unitPrice: Number(resolvedMenuItem.price || 0),
          name: resolvedMenuItem.name,
          itemNote: '',
          modifiers: [],
        },
      ];
    });
  };

  const changeEditedItemQuantity = (menuItemId, delta) => {
    setEditingItems((current) =>
      current
        .map((item) =>
          String(item.menuItemId) === String(menuItemId)
            ? { ...item, quantity: Number(item.quantity || 0) + delta }
            : item
        )
        .filter((item) => Number(item.quantity || 0) > 0)
    );
  };

  const getEditedItemQuantity = (menuItemId) =>
    editingItems.find((item) => String(item.menuItemId) === String(menuItemId))?.quantity || 0;

  const saveBillEdits = async () => {
    if (!editingBill?.id) {
      return;
    }

    if (editingItems.length === 0) {
      setError('Keep at least one item in the bill.');
      return;
    }

    setActioningBillId(editingBill.id);
    setError('');

    try {
      const payload = {
        orderType: editingBill.orderType,
        ...(editingBill.tableId ? { tableId: editingBill.tableId } : {}),
        items: editingItems.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: Number(item.quantity || 0),
          unitPrice: Number(item.unitPrice ?? item.price ?? 0),
          name: item.name || '',
          itemNote: item.itemNote || '',
          modifiers: item.modifiers || [],
        })),
        totalAmount: editingSubtotal,
      };

      await orderAPI.updateOrder(editingBill.id, payload);
      const refreshedBillResponse = await orderAPI.getOrder(editingBill.id);
      const refreshedBill = refreshedBillResponse.data?.data || editingBill;
      setEditingBill(null);
      setEditingItems([]);
      if (payingBill?.id === refreshedBill.id) {
        setPayingBill(refreshedBill);
      }
      await reloadOrders();
      setSuccess(`${formatDisplayOrderNumber(refreshedBill)} updated before settlement.`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to update the bill.');
    } finally {
      setActioningBillId('');
    }
  };

  if (loading && bills.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {managerAlertMessage ? (
        <Toast type="warning" message={managerAlertMessage} onClose={() => setManagerAlertMessage('')} autoDismissMs={6500} />
      ) : null}
      {success ? <Toast type="success" message={success} onClose={() => setSuccess('')} /> : null}
      {error ? <Toast type="error" message={error} onClose={() => setError('')} /> : null}

      <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-4 shadow-[var(--shadow-card)]">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">Billing Control</p>
        <h1 className="mt-2 text-2xl font-black text-[var(--text-primary)]">Track live bills, unpaid tables, and manager-approved discounts</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Confirm payments manually, keep payment status consistent, and print bills only after the order data is safely settled.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-[var(--text-secondary)]">All bills</p>
          <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{bills.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-[var(--text-secondary)]">Need action</p>
          <p className="mt-2 text-3xl font-bold text-amber-400">{unpaidBills.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-[var(--text-secondary)]">Pending amount</p>
          <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{formatCurrency(pendingAmount)}</p>
        </Card>
      </div>

      <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3 shadow-[var(--shadow-card)]">
            <div className="flex items-start gap-3">
              <BellRing className="mt-0.5 h-5 w-5 text-[var(--color-primary)]" />
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Manager billing queue</p>
                <p className="text-sm text-[var(--text-secondary)]">Unpaid bills stay first. Paid bills stay ready for print.</p>
              </div>
            </div>
            <Button variant="secondary" onClick={() => Promise.allSettled([reloadOrders(), refetchProfile()])}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {orderedBills.map((bill) => {
            const approval = bill?.approvedDiscount || approvedDiscounts[bill.id];
            const summary = getBillSummary(bill, {
              managerDiscountPercent: approval?.percent || 0,
              billingSettings: restaurantBillingSettings,
              defaultServiceCharge: numericServiceCharge,
            });
            const unpaid = isUnpaid(bill);

            return (
              <Card key={bill.id} className="flex h-full flex-col p-2.5">
                <div className="flex min-h-[10.5rem] flex-col gap-2 rounded-[1.2rem] bg-[var(--bg-card-muted)] p-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-[var(--text-primary)]">{formatDisplayOrderNumber(bill)}</p>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${
                          unpaid
                            ? 'border-amber-400/40 bg-amber-400/15 text-amber-300'
                            : 'border-emerald-400/45 bg-emerald-500 text-white shadow-[0_10px_30px_rgba(16,185,129,0.28)]'
                        }`}
                      >
                        {unpaid ? 'Pending Payment' : 'Paid'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">Table {bill.tableNumber || 'Walk-in'}</p>
                    <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{formatDate(bill.createdAt)}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-[var(--bg-card)] px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">Bill Total</p>
                      <p className="mt-0.5 text-base font-bold text-[var(--text-primary)]">{formatCurrency(summary.grandTotal)}</p>
                    </div>
                    <div className="rounded-xl bg-[var(--bg-card)] px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                        {unpaid ? 'Final Amount' : 'Paid Amount'}
                      </p>
                      <p className={`mt-0.5 text-base font-bold ${unpaid ? 'text-amber-300' : 'text-emerald-400'}`}>
                        {formatCurrency(unpaid ? summary.grandTotal : summary.paidAmount)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex flex-1 flex-col gap-2">
                  <div className="grid gap-2">
                    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">Payment</p>
                      <p className="mt-0.5 break-words text-xs font-semibold text-[var(--text-primary)]">
                        {(summary.paymentMethod || 'cash').toUpperCase()} • {summary.paymentStatus}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">Discount</p>
                      <p className="mt-0.5 break-words text-xs font-semibold text-[var(--text-primary)]">
                        {approval ? `${approval.percent}% approved` : 'No discount approved'}
                      </p>
                      {approval?.approvedBy ? (
                        <p className="mt-0.5 break-words text-[11px] text-[var(--text-secondary)]">By {approval.approvedBy}</p>
                      ) : null}
                    </div>
                    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">Status</p>
                      <p className={`mt-0.5 break-words text-xs font-semibold ${unpaid ? 'text-[var(--text-primary)]' : 'text-emerald-400'}`}>
                        {unpaid ? 'Awaiting payment confirmation' : 'Paid and ready to print'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-auto grid gap-2">
                    <Button variant="secondary" className="w-full px-3 py-2 text-xs" onClick={() => setSelectedBill(bill)}>
                      <BadgePercent className="h-4 w-4" />
                      Approve Discount
                    </Button>
                    {unpaid ? (
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="secondary" className="w-full px-3 py-2 text-xs" onClick={() => openEditBill(bill)} disabled={actioningBillId === bill.id}>
                          {actioningBillId === bill.id ? 'Loading...' : 'Edit'}
                        </Button>
                        <Button
                          className="w-full px-3 py-2 text-xs"
                          onClick={() => (bill?.billing?.invoiceNumber ? openPrintedBill(bill) : openPayBill(bill))}
                          disabled={actioningBillId === bill.id}
                        >
                          <Wallet className="h-4 w-4" />
                          {actioningBillId === bill.id ? 'Loading...' : bill?.billing?.invoiceNumber ? 'Open Bill' : 'Settle'}
                        </Button>
                      </div>
                    ) : (
                      <Button variant="secondary" className="w-full px-3 py-2 text-xs" onClick={() => openPrintedBill(bill)} disabled={actioningBillId === bill.id}>
                        <Receipt className="h-4 w-4" />
                        {actioningBillId === bill.id ? 'Loading...' : 'Print Bill'}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
          </div>
      </div>

      <Modal
        title={selectedBill ? `Approve discount for ${formatDisplayOrderNumber(selectedBill)}` : 'Approve discount'}
        isOpen={Boolean(selectedBill)}
        onClose={() => setSelectedBill(null)}
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <Input
            label="Discount percent"
            type="number"
            min="0"
            value={discountPercent}
            onChange={(event) => setDiscountPercent(event.target.value)}
          />
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">Manager note</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="input min-h-[110px] resize-y"
              placeholder="Reason for discount approval."
            />
          </label>
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button variant="secondary" className="w-full sm:flex-1" onClick={() => setSelectedBill(null)}>
              Cancel
            </Button>
            <Button className="w-full sm:flex-1" onClick={submitApproval} disabled={actioningBillId === selectedBill?.id}>
              {actioningBillId === selectedBill?.id ? 'Approving...' : 'Approve'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        title={payingBill ? `Settle ${formatDisplayOrderNumber(payingBill)}` : 'Settle bill'}
        isOpen={Boolean(payingBill)}
        onClose={() => setPayingBill(null)}
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          <div className="rounded-2xl bg-[var(--bg-card-muted)] p-4">
            <p className="text-sm text-[var(--text-secondary)]">Bill total</p>
            <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{formatCurrency(billTotalWithServiceCharge)}</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Table {payingBill?.tableNumber || 'Walk-in'} • {formatDate(payingBill?.createdAt)}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-[var(--text-primary)]">Payment method</span>
              <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="input">
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
              </select>
            </label>
            <Input
              label={paymentMethod === 'cash' ? 'Amount received' : 'Paid amount'}
              type="number"
              value={amountReceived}
              onChange={(event) => setAmountReceived(event.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">Bill Total</p>
              <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">{formatCurrency(billTotalWithServiceCharge)}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">Paid Amount</p>
              <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">{formatCurrency(numericAmountReceived)}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Loyalty</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Check customer points and redeem them before settling.</p>
              </div>
              <div className="rounded-xl bg-[var(--bg-card-muted)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)]">
                Payable {formatCurrency(payableAfterLoyalty)}
              </div>
            </div>

            {numericServiceCharge > 0 ? (
              <div className="mt-4 rounded-xl bg-[var(--bg-card-muted)] px-3 py-2 text-sm font-medium text-[var(--text-primary)]">
                Service charge from settings: {formatCurrency(numericServiceCharge)}
              </div>
            ) : null}

            <div className="mt-4 flex gap-2">
              <input
                type="tel"
                inputMode="numeric"
                value={loyaltyPhone}
                onChange={(event) => setLoyaltyPhone(event.target.value)}
                placeholder="Customer phone for points"
                className="min-h-[3.5rem] w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 text-sm font-medium text-[var(--text-primary)] outline-none transition focus:border-[var(--color-primary)]"
              />
              <button
                type="button"
                onClick={handleCheckLoyalty}
                disabled={isCheckingLoyalty || String(loyaltyPhone || '').trim().length < 10}
                className="min-h-[3.5rem] shrink-0 rounded-2xl bg-[var(--color-primary)] px-4 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCheckingLoyalty ? 'Checking...' : 'Check'}
              </button>
            </div>

            {loyaltyProfile?.customerPhone ? (
              <div className="mt-4 rounded-2xl bg-[var(--bg-card-muted)] p-4">
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-[var(--text-secondary)]">Points Balance</p>
                    <p className="mt-1 font-bold text-[var(--text-primary)]">{loyaltyProfile.pointsBalance}</p>
                  </div>
                  <div>
                    <p className="text-[var(--text-secondary)]">Visits</p>
                    <p className="mt-1 font-bold text-[var(--text-primary)]">{loyaltyProfile.visitCount}</p>
                  </div>
                  <div>
                    <p className="text-[var(--text-secondary)]">Earned</p>
                    <p className="mt-1 font-bold text-[var(--text-primary)]">{loyaltyProfile.totalEarnedPoints}</p>
                  </div>
                  <div>
                    <p className="text-[var(--text-secondary)]">Redeemed</p>
                    <p className="mt-1 font-bold text-[var(--text-primary)]">{loyaltyProfile.totalRedeemedPoints}</p>
                  </div>
                </div>

                <label className="mt-4 block space-y-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">Redeem Points</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={redeemPoints}
                    onChange={(event) => setRedeemPoints(event.target.value)}
                    placeholder="0"
                    className="min-h-[3.5rem] w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 text-sm font-medium text-[var(--text-primary)] outline-none transition focus:border-[var(--color-primary)]"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-secondary)]">
                    <span>1 point = {formatCurrency(1)} discount</span>
                    <span>Redeeming now: {formatCurrency(loyaltyRedeemPreview)}</span>
                  </div>
                </label>
              </div>
            ) : null}
          </div>

          {paymentMethod === 'cash' && paymentGap > 0 ? (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm font-medium text-amber-200">
              Collect {formatCurrency(paymentGap)} more before settling this bill.
            </div>
          ) : null}

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">Payment note</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="input min-h-[110px] resize-y"
              placeholder="Optional payment note."
            />
          </label>

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button variant="secondary" className="w-full sm:flex-1" onClick={() => setPayingBill(null)}>
              Cancel
            </Button>
            <Button
              className="w-full sm:flex-1"
              onClick={createBill}
              disabled={actioningBillId === payingBill?.id || (paymentMethod === 'cash' && paymentGap > 0)}
            >
              <Wallet className="h-4 w-4" />
              {actioningBillId === payingBill?.id ? 'Creating...' : 'Create Bill'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        title={editingBill ? `Edit ${formatDisplayOrderNumber(editingBill)} Before Settlement` : 'Edit bill'}
        isOpen={Boolean(editingBill)}
        onClose={() => {
          if (actioningBillId === editingBill?.id) {
            return;
          }
          setEditingBill(null);
          setEditingItems([]);
        }}
        maxWidth="max-w-6xl"
      >
        {editingBill ? (
          <div className="grid gap-4 lg:grid-cols-[1.45fr,0.95fr]">
            <div className="space-y-3">
              <div>
                <p className="text-sm text-[var(--text-secondary)]">Adjust missed items or quantity before settlement.</p>
              </div>
              <MenuPanel
                categories={editCategories}
                activeCategoryId={editActiveCategory}
                onCategoryChange={setEditActiveCategory}
                onAddItem={addMenuItemToBillEdit}
                onIncreaseItem={addMenuItemToBillEdit}
                onDecreaseItem={(menuItemId) => changeEditedItemQuantity(menuItemId, -1)}
                getItemQuantity={getEditedItemQuantity}
                searchValue={editSearchTerm}
                onSearchChange={setEditSearchTerm}
                loading={false}
                error=""
              />
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl bg-[var(--bg-card-muted)] p-4">
                <p className="text-sm text-[var(--text-secondary)]">Current bill</p>
                <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{formatCurrency(editingSummary.grandTotal)}</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {editingBill.tableNumber ? `Table ${editingBill.tableNumber}` : 'Walk-in'} • {formatDate(editingBill.createdAt)}
                </p>
              </div>

              <div className="max-h-[24rem] space-y-3 overflow-y-auto rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
                {editingItems.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">Add items to continue.</p>
                ) : (
                  editingItems.map((item) => (
                    <div key={`${editingBill.id}-${item.menuItemId}`} className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--bg-card-muted)] p-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-[var(--text-primary)]">{item.name}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{formatCurrency(item.unitPrice)} each</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => changeEditedItemQuantity(item.menuItemId, -1)}
                          className="h-9 w-9 rounded-full bg-[var(--bg-card)] text-[var(--text-primary)]"
                        >
                          -
                        </button>
                        <span className="w-7 text-center font-bold text-[var(--text-primary)]">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => changeEditedItemQuantity(item.menuItemId, 1)}
                          className="h-9 w-9 rounded-full bg-[var(--color-primary)] text-white"
                        >
                          +
                        </button>
                      </div>
                      <p className="font-semibold text-[var(--text-primary)]">
                        {formatCurrency(Number(item.quantity || 0) * Number(item.unitPrice ?? item.price ?? 0))}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 text-sm">
                <div className="flex justify-between text-[var(--text-secondary)]"><span>Subtotal</span><span>{formatCurrency(editingSummary.subtotal)}</span></div>
                <div className="flex justify-between text-[var(--text-secondary)]"><span>CGST ({editingSummary.cgstRate}%)</span><span>{formatCurrency(editingSummary.cgstAmount)}</span></div>
                <div className="flex justify-between text-[var(--text-secondary)]"><span>SGST ({editingSummary.sgstRate}%)</span><span>{formatCurrency(editingSummary.sgstAmount)}</span></div>
                {numericServiceCharge > 0 ? (
                  <div className="flex justify-between text-[var(--text-secondary)]"><span>Service charge</span><span>{formatCurrency(numericServiceCharge)}</span></div>
                ) : null}
                <div className="flex justify-between text-lg font-bold text-[var(--text-primary)]"><span>Updated total</span><span>{formatCurrency(editingSummary.grandTotal)}</span></div>
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <Button
                  variant="secondary"
                  className="w-full sm:flex-1"
                  onClick={() => {
                    setEditingBill(null);
                    setEditingItems([]);
                  }}
                  disabled={actioningBillId === editingBill.id}
                >
                  Cancel
                </Button>
                <Button
                  className="w-full sm:flex-1"
                  onClick={saveBillEdits}
                  disabled={actioningBillId === editingBill.id || editingItems.length === 0}
                >
                  {actioningBillId === editingBill.id ? 'Saving...' : 'Save Bill Changes'}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
