import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import MenuPanel from '../components/pos/MenuPanel';
import Modal from '../components/common/Modal';
import Toast from '../components/common/Toast';
import { useApi } from '../hooks/useApi';
import { useAuthStore } from '../context/authStore';
import { orderAPI, menuAPI, restaurantAPI } from '../services/apiEndpoints';
import { formatCurrency, formatDisplayOrderNumber } from '../utils/formatters';
import { autoPrintBill, printKotReceipt } from '../utils/printerService';
import { buildInvoiceData, calculateInvoiceSummary, getRestaurantBillingSettings } from '../utils/invoice';

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

export default function ManagerOrders() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { data: menuData = {}, refetch: refetchMenu } = useApi(() => menuAPI.getItems({ limit: 300 }));
  const { data: categoriesData = {}, refetch: refetchCategories } = useApi(menuAPI.getCategories);
  const { data: restaurantProfile = {}, refetch: refetchProfile } = useApi(restaurantAPI.getProfile);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [draftItems, setDraftItems] = useState([]);
  const [draftOrderId, setDraftOrderId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCustomer, setShowCustomer] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);

  const menuItems = useMemo(
    () => (menuData?.items || []).map(normalizeMenuItem).filter((item) => item.isAvailable),
    [menuData]
  );

  const categories = useMemo(() => {
    const normalizedCategories = (categoriesData?.categories || []).map(normalizeCategory);
    const query = String(searchTerm || '').trim().toLowerCase();
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

    const groupedCategories = [{ id: 'all', name: 'All', items: searchedItems }, ...groupedItems].map((category, index) => ({
      ...category,
      renderKey: `${category.id || 'category'}-${index}`,
    }));

    if (uncategorizedItems.length > 0) {
      groupedCategories.push({
        id: 'uncategorized',
        name: 'Uncategorized',
        items: uncategorizedItems,
        renderKey: `uncategorized-${uncategorizedItems.length}`,
      });
    }

    return groupedCategories;
  }, [categoriesData, menuItems, searchTerm]);

  useEffect(() => {
    if (!categories.some((category) => category.id === activeCategory)) {
      setActiveCategory(categories[0]?.id || 'all');
    }
  }, [activeCategory, categories]);

  const restaurantBillingSettings = useMemo(() => getRestaurantBillingSettings(restaurantProfile), [restaurantProfile]);

  const draftTotal = useMemo(
    () => draftItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0),
    [draftItems]
  );

  const draftInvoicePreview = useMemo(
    () =>
      calculateInvoiceSummary({
        subtotal: draftTotal,
        cgstRate: restaurantBillingSettings.cgstRate,
        sgstRate: restaurantBillingSettings.sgstRate,
      }),
    [draftTotal, restaurantBillingSettings]
  );

  const addMenuItemToDraft = (menuItemOrId) => {
    const resolvedMenuItem =
      typeof menuItemOrId === 'object' && menuItemOrId !== null
        ? menuItemOrId
        : menuItems.find((item) => String(item.id) === String(menuItemOrId));

    if (!resolvedMenuItem?.id) {
      return;
    }

    setDraftItems((current) => {
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
          name: resolvedMenuItem.name,
          unitPrice: Number(resolvedMenuItem.price || 0),
          quantity: 1,
        },
      ];
    });
  };

  const changeDraftQuantity = (menuItemId, delta) => {
    setDraftItems((current) =>
      current
        .map((item) =>
          String(item.menuItemId) === String(menuItemId)
            ? { ...item, quantity: Number(item.quantity || 0) + delta }
            : item
        )
        .filter((item) => Number(item.quantity || 0) > 0)
    );
  };

  const resetComposer = () => {
    setDraftOrderId('');
    setDraftItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setOrderNote('');
    setPaymentMethod('cash');
    setAmountReceived('');
    setShowCustomer(false);
    setShowSettleModal(false);
    setError('');
    setSuccess('');
  };

  const persistDraftOrder = async ({ sendKitchen = false } = {}) => {
    if (draftItems.length === 0) {
      throw new Error('Add at least one item to build the takeaway order.');
    }

    const payload = {
      orderType: 'takeaway',
      items: draftItems.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
        name: item.name,
      })),
      totalAmount: draftInvoicePreview.subtotal,
      notes: orderNote.trim(),
      paymentMethod,
      source: 'direct',
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
    };

    const response = draftOrderId ? await orderAPI.updateOrder(draftOrderId, payload) : await orderAPI.createOrder(payload);
    let savedOrder = response.data?.data;

    if (sendKitchen) {
      const sendResponse = await orderAPI.sendToKitchen(savedOrder.id);
      savedOrder = sendResponse.data?.data?.order || savedOrder;
    }

    setDraftOrderId(savedOrder?.id || '');
    return savedOrder;
  };

  const handleSendToKitchen = async () => {
    try {
      setLoadingAction(true);
      setError('');
      const saved = await persistDraftOrder({ sendKitchen: true });
      let printMessage = '';

      try {
        const refreshedOrderResponse = await orderAPI.getOrder(saved.id);
        const refreshedOrder = refreshedOrderResponse.data?.data || saved;
        const latestTicket = Array.isArray(refreshedOrder?.kitchenTickets) && refreshedOrder.kitchenTickets.length > 0
          ? [...refreshedOrder.kitchenTickets].sort((left, right) => Number(right.sequence || 0) - Number(left.sequence || 0))[0]
          : null;

        if (latestTicket) {
          const printResult = await printKotReceipt({
            ticket: latestTicket,
            order: refreshedOrder,
            restaurant: restaurantProfile,
            fallbackToBrowser: true,
          });

          if (printResult?.fallback && printResult?.error) {
            printMessage = ' KOT printer was unavailable, so browser print opened instead.';
          }
        }
      } catch (printError) {
        printMessage = ` ${printError.message || 'KOT print failed.'}`;
      }

      setSuccess(`${formatDisplayOrderNumber(saved)} sent to kitchen.${printMessage}`);
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Failed to send to kitchen');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSettleBill = async () => {
    try {
      setLoadingAction(true);
      setError('');
      const saved = await persistDraftOrder({ sendKitchen: false });
      const orderId = saved?.id || draftOrderId;
      if (!orderId) throw new Error('Save the order before settling.');
      const hasEnteredAmount = String(amountReceived || '').trim() !== '';
      const receivedAmount = hasEnteredAmount ? Number(amountReceived) : null;
      if (paymentMethod === 'cash' && (!Number.isFinite(receivedAmount) || receivedAmount + 0.001 < Number(draftInvoicePreview.grandTotal || 0))) {
        throw new Error('Cash received must be at least the bill total.');
      }
      const settleResponse = await orderAPI.settleOrder(orderId, {
        paymentMethod,
        amountReceived:
          paymentMethod === 'cash'
            ? receivedAmount
            : hasEnteredAmount && Number.isFinite(receivedAmount)
              ? receivedAmount
              : Number(draftInvoicePreview.grandTotal || 0),
      });
      const settledOrder = settleResponse.data?.data || saved;
      const invoiceData = buildInvoiceData({
        order: settledOrder,
        restaurant: restaurantProfile,
        cashierName: user?.name || user?.email || 'Manager',
      });
      let autoPrintError = '';

      try {
        const printResult = await autoPrintBill({
          order: settledOrder,
          restaurant: restaurantProfile,
          invoice: invoiceData,
          cashierName: user?.name || user?.email || 'Manager',
        });
        if (printResult?.fallback && printResult?.error) {
          autoPrintError = 'Billing printer was unavailable, so browser print opened instead.';
        }
      } catch (printError) {
        autoPrintError = printError.message || 'Auto-print failed. Use Print Bill manually.';
      }

      setSuccess(`${formatDisplayOrderNumber(settledOrder)} settled.`);
      resetComposer();
      await Promise.allSettled([refetchMenu(), refetchCategories(), refetchProfile()]);
      navigate(`/manager/bills/${settledOrder?.id || orderId}`, {
        state: {
          order: settledOrder,
          restaurant: restaurantProfile,
          invoice: invoiceData,
          returnTo: '/manager/takeaway-orders',
          cashierName: user?.name || user?.email || 'Manager',
          autoPrintError,
        },
      });
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Failed to settle bill');
    } finally {
      setLoadingAction(false);
    }
  };

  const draftCartItems = useMemo(
    () =>
      draftItems.map((item) => ({
        id: item.menuItemId,
        name: item.name,
        price: Number(item.unitPrice || 0),
        qty: Number(item.quantity || 0),
      })),
    [draftItems]
  );

  const openSettleModal = () => {
    if (draftItems.length === 0 || loadingAction) {
      return;
    }

    setPaymentMethod('cash');
    setAmountReceived('');
    setShowSettleModal(true);
    setError('');
  };

  return (
    <div className="space-y-4 p-4">
      {success ? <Toast type="success" message={success} /> : null}
      {error ? <Toast type="error" message={error} /> : null}

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-3">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">Takeaway</p>
            <h1 className="text-2xl font-black text-[var(--text-primary)]">Fast Billing</h1>
          </div>
          <MenuPanel
            categories={categories}
            activeCategoryId={activeCategory}
            onCategoryChange={setActiveCategory}
            onAddItem={addMenuItemToDraft}
            onIncreaseItem={addMenuItemToDraft}
            onDecreaseItem={(menuItemId) => changeDraftQuantity(menuItemId, -1)}
            getItemQuantity={(id) => draftCartItems.find((i) => String(i.id) === String(id))?.qty || 0}
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            loading={false}
            error=""
          />
        </div>

        <Card className="flex h-full flex-col gap-4 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">Cart</p>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">{draftOrderId ? formatDisplayOrderNumber({ displayOrderNumber: '', id: draftOrderId }) : 'New Takeaway'}</h2>
            </div>
            <button onClick={resetComposer} className="text-sm font-semibold text-rose-600">Clear</button>
          </div>

          <div className="space-y-3 overflow-y-auto">
            {draftCartItems.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">Tap items to add to cart.</p>
            ) : (
              draftCartItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-2xl border border-[var(--border-color)] p-3">
                  <div>
                    <p className="font-semibold text-[var(--text-primary)]">{item.name}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{formatCurrency(item.price)} each</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => changeDraftQuantity(item.id, -1)} className="h-9 w-9 rounded-full bg-[var(--bg-card-muted)] text-[var(--text-primary)]">-</button>
                    <span className="w-8 text-center font-bold text-[var(--text-primary)]">{item.qty}</span>
                    <button onClick={() => changeDraftQuantity(item.id, 1)} className="h-9 w-9 rounded-full bg-[var(--color-primary)] text-white">+</button>
                  </div>
                  <span className="font-semibold text-[var(--text-primary)]">{formatCurrency(item.qty * item.price)}</span>
                </div>
              ))
            )}
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-[var(--text-secondary)]"><span>Subtotal</span><span>{formatCurrency(draftInvoicePreview.subtotal)}</span></div>
            <div className="flex justify-between text-[var(--text-secondary)]"><span>CGST ({draftInvoicePreview.cgstRate}%)</span><span>{formatCurrency(draftInvoicePreview.cgstAmount)}</span></div>
            <div className="flex justify-between text-[var(--text-secondary)]"><span>SGST ({draftInvoicePreview.sgstRate}%)</span><span>{formatCurrency(draftInvoicePreview.sgstAmount)}</span></div>
            <div className="flex justify-between text-lg font-bold text-[var(--text-primary)]"><span>Final Amount</span><span>{formatCurrency(draftInvoicePreview.grandTotal)}</span></div>
          </div>

          <button
            onClick={() => setShowCustomer((v) => !v)}
            className="text-sm font-semibold text-[var(--text-primary)] underline"
          >
            {showCustomer ? 'Hide Customer Details' : 'Add Customer Details'}
          </button>

          {showCustomer ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Customer Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Optional" />
              <Input label="Phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Optional" />
              <label className="sm:col-span-2 block space-y-2">
                <span className="text-sm font-medium text-[var(--text-primary)]">Note</span>
                <textarea
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  placeholder="Pickup note"
                  className="min-h-[70px] w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--color-primary)]"
                />
              </label>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Button onClick={handleSendToKitchen} disabled={loadingAction || draftItems.length === 0}>
              {loadingAction ? 'Working...' : 'Send to Kitchen'}
            </Button>
            <Button variant="secondary" onClick={openSettleModal} disabled={loadingAction || draftItems.length === 0}>
              {loadingAction ? 'Working...' : 'Settle Bill'}
            </Button>
          </div>
        </Card>
      </div>

      <Modal
        title="Settle Takeaway Bill"
        isOpen={showSettleModal}
        onClose={() => {
          if (!loadingAction) {
            setShowSettleModal(false);
          }
        }}
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <div className="rounded-2xl bg-[var(--bg-card-muted)] p-4">
            <p className="text-sm text-[var(--text-secondary)]">Final payable</p>
            <p className="mt-2 text-3xl font-black text-[var(--text-primary)]">
              {formatCurrency(draftInvoicePreview.grandTotal)}
            </p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {draftCartItems.length} item{draftCartItems.length === 1 ? '' : 's'} in this takeaway bill
            </p>
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-semibold text-[var(--text-primary)]">Payment Method</p>
            <div className="grid grid-cols-2 gap-2">
              {['cash', 'upi'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setPaymentMethod(mode)}
                  className={`rounded-xl px-3 py-3 text-sm font-semibold ${
                    paymentMethod === mode
                      ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                      : 'bg-[var(--bg-card-muted)] text-[var(--text-secondary)]'
                  }`}
                >
                  {mode.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <Input
            label={paymentMethod === 'cash' ? 'Cash Received' : 'Paid Amount'}
            type="number"
            value={amountReceived}
            onChange={(event) => setAmountReceived(event.target.value)}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">Bill Total</p>
              <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">{formatCurrency(draftInvoicePreview.grandTotal)}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                {paymentMethod === 'cash' ? 'Change Due' : 'Paid'}
              </p>
              <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">
                {paymentMethod === 'cash'
                  ? formatCurrency(Math.max(0, Number((Number(amountReceived || 0) - Number(draftInvoicePreview.grandTotal || 0)).toFixed(2))))
                  : formatCurrency(Number(amountReceived || 0))}
              </p>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button
              variant="secondary"
              className="w-full sm:flex-1"
              onClick={() => setShowSettleModal(false)}
              disabled={loadingAction}
            >
              Cancel
            </Button>
            <Button
              className="w-full sm:flex-1"
              onClick={handleSettleBill}
              disabled={loadingAction || draftItems.length === 0}
            >
              {loadingAction ? 'Settling...' : 'Confirm Settlement'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
