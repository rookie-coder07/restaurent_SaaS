import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, Bike, Loader, Receipt, ShoppingBag, Store, TableProperties, Utensils } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { menuAPI, orderAPI, tableAPI } from '../services/apiEndpoints';
import MenuPanel from '../components/pos/MenuPanel';
import CartPanel from '../components/pos/CartPanel';
import OrderControls from '../components/pos/OrderControls';
import OnlineOrderInbox from '../components/pos/OnlineOrderInbox';
import OnlineOrderDetailsPanel from '../components/pos/OnlineOrderDetailsPanel';
import PaymentPanel from '../components/pos/PaymentPanel';
import Modal from '../components/common/Modal';
import { formatCurrency, formatDisplayOrderNumber } from '../utils/formatters';
import { printKitchenTicket } from '../utils/kotPrint';

function formatOrderStatusLabel(status) {
  if (!status) {
    return 'Draft';
  }

  if (status === 'awaiting_waiter_approval') {
    return 'Awaiting Waiter Approval';
  }

  return status.replace(/_/g, ' ');
}

function normalizeId(value) {
  return value?.id || value?._id || '';
}

function normalizeMenuItem(item) {
  return {
    id: normalizeId(item),
    name: item.name || 'Untitled item',
    description: item.description || '',
    price: Number(item.price || 0),
    categoryId: item.categoryId || item.category_id || item.category?.id || item.category?._id || '',
    isAvailable: item.isAvailable !== false && item.status !== 'inactive',
  };
}

function normalizeCategory(category) {
  return {
    id: normalizeId(category),
    name: category.name || 'Uncategorized',
  };
}

function normalizeTable(table) {
  return {
    id: normalizeId(table),
    tableNumber: table.tableNumber || table.table_number || table.name || '',
    status: table.status || 'available',
  };
}

function normalizeOrderItemForCart(item) {
  return {
    id: item.menuItemId || item.menu_item_id || item.id,
    name: item.name || 'Untitled item',
    price: Number(item.unitPrice ?? item.unit_price ?? item.price ?? 0),
    qty: Number(item.quantity || item.qty || 0),
    itemNote: item.itemNote || item.note || item.specialInstructions || '',
    modifiers: Array.isArray(item.modifiers) ? item.modifiers : [],
    station: item.station || 'Main Kitchen',
  };
}

function normalizePaymentMethod(value) {
  return String(value || '').toLowerCase() === 'upi' ? 'upi' : 'cash';
}

function createItemsSignature(items = []) {
  return [...items]
    .map((item) => {
      const itemId = item.menuItemId || item.id;
      const quantity = Number(item.quantity ?? item.qty ?? 0);
      const unitPrice = Number(item.unitPrice ?? item.price ?? 0).toFixed(2);
      const itemNote = String(item.itemNote || item.note || '').trim();
      const modifiers = (item.modifiers || []).join(',');
      return `${itemId}:${quantity}:${unitPrice}:${itemNote}:${modifiers}`;
    })
    .sort()
    .join('|');
}

function parseModifiersInput(value) {
  return Array.from(
    new Set(
      String(value || '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  ).slice(0, 10);
}

function getLatestKitchenTicket(order) {
  const tickets = Array.isArray(order?.kitchenTickets) ? order.kitchenTickets : [];
  if (tickets.length === 0) {
    return null;
  }

  return [...tickets].sort((left, right) => Number(right.sequence || 0) - Number(left.sequence || 0))[0];
}

function buildDraftFromOrder(order) {
  const recalledItems = (order?.items || []).map(normalizeOrderItemForCart);
  const recalledSubtotal = recalledItems.reduce((sum, item) => sum + item.price * item.qty, 0);
  const savedTotal = Number(order?.totalAmount ?? order?.total ?? recalledSubtotal);
  const inferredDiscount = Math.max(0, Number((recalledSubtotal - savedTotal).toFixed(2)));

  return {
    cartItems: recalledItems,
    discountType: 'flat',
    discountValue: inferredDiscount > 0 ? String(inferredDiscount) : '',
    paymentMethod: normalizePaymentMethod(order?.paymentMethod),
  };
}

function formatDateTimeInputValue(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

function normalizeOnlineDraft(order = null) {
  const online = order?.online || {};

  return {
    source: online.source || 'direct',
    promisedAt: formatDateTimeInputValue(online.promisedAt),
    paymentState: online.paymentState || 'pending',
    customerName: online.customerName || '',
    customerPhone: online.customerPhone || '',
    customerAddress: online.customerAddress || '',
    channelOrderId: online.channelOrderId || '',
  };
}

function createOnlineDraftSignature({
  orderType = '',
  source = '',
  promisedAt = '',
  paymentState = '',
  customerName = '',
  customerPhone = '',
  customerAddress = '',
  channelOrderId = '',
} = {}) {
  if (!orderType || orderType === 'dine-in') {
    return 'dine-in';
  }

  return JSON.stringify({
    orderType,
    source,
    promisedAt,
    paymentState,
    customerName: customerName.trim(),
    customerPhone: customerPhone.trim(),
    customerAddress: customerAddress.trim(),
    channelOrderId: channelOrderId.trim(),
  });
}

function serializePromisedAt(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default function POS() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: menuItemsData = {}, loading: menuLoading, error: menuError } = useApi(() => menuAPI.getItems({ limit: 300 }));
  const { data: categoryData = {} } = useApi(() => menuAPI.getCategories());
  const { data: tableData = {} } = useApi(() => tableAPI.getTables({ limit: 200 }));
  const requestedTableId = searchParams.get('tableId') || '';
  const requestedOrderId = searchParams.get('orderId') || '';

  const [cartItems, setCartItems] = useState([]);
  const [orderType, setOrderType] = useState('');
  const [selectedTableId, setSelectedTableId] = useState('');
  const [discountType, setDiscountType] = useState('flat');
  const [discountValue, setDiscountValue] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState('all');
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingToKitchen, setIsSendingToKitchen] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);
  const [isLoadingTableOrder, setIsLoadingTableOrder] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [pinnedOrderId, setPinnedOrderId] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [editingItemId, setEditingItemId] = useState('');
  const [showItemDetailsModal, setShowItemDetailsModal] = useState(false);
  const [itemNoteDraft, setItemNoteDraft] = useState('');
  const [itemModifiersDraft, setItemModifiersDraft] = useState('');
  const [onlineSource, setOnlineSource] = useState('direct');
  const [promisedAt, setPromisedAt] = useState('');
  const [onlinePaymentState, setOnlinePaymentState] = useState('pending');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [channelOrderId, setChannelOrderId] = useState('');
  const [onlineInbox, setOnlineInbox] = useState([]);
  const [isLoadingOnlineInbox, setIsLoadingOnlineInbox] = useState(false);
  const [onlineInboxError, setOnlineInboxError] = useState('');
  const [updatingOnlineOrderId, setUpdatingOnlineOrderId] = useState('');

  const items = useMemo(
    () => (menuItemsData?.items || []).map(normalizeMenuItem).filter((item) => item.isAvailable),
    [menuItemsData]
  );

  const tables = useMemo(
    () =>
      (tableData?.tables || [])
        .map(normalizeTable)
        .filter((table) => String(table.status).toLowerCase() !== 'inactive')
        .sort((left, right) => Number(left.tableNumber || 0) - Number(right.tableNumber || 0)),
    [tableData]
  );
  const selectedTable = useMemo(
    () => tables.find((table) => table.id === selectedTableId) || null,
    [selectedTableId, tables]
  );

  useEffect(() => {
    if (!requestedTableId) {
      return;
    }

    setOrderType((current) => current || 'dine-in');
    setSelectedTableId((current) => current || requestedTableId);
  }, [requestedTableId]);

  const categories = useMemo(() => {
    const normalizedCategories = (categoryData?.categories || []).map(normalizeCategory);
    const groupedItems = normalizedCategories
      .map((category) => ({
        ...category,
        items: items.filter((item) => String(item.categoryId || '') === String(category.id)),
      }))
      .filter((category) => category.items.length > 0);

    const uncategorizedItems = items.filter(
      (item) => !groupedItems.some((category) => category.items.some((categoryItem) => categoryItem.id === item.id))
    );

    const baseCategories = [
      { id: 'all', name: 'All Items', items },
      ...groupedItems,
    ];

    if (uncategorizedItems.length > 0) {
      baseCategories.push({
        id: 'uncategorized',
        name: 'Uncategorized',
        items: uncategorizedItems,
      });
    }

    return baseCategories;
  }, [categoryData, items]);

  useEffect(() => {
    if (!categories.some((category) => category.id === activeCategoryId)) {
      setActiveCategoryId(categories[0]?.id || 'all');
    }
  }, [activeCategoryId, categories]);

  useEffect(() => {
    if (orderType !== 'dine-in') {
      setIsLoadingTableOrder(false);
    }
  }, [orderType]);

  useEffect(() => {
    refreshOnlineInbox();
  }, []);

  useEffect(() => {
    if (orderType !== 'dine-in') {
      return undefined;
    }

    if (!selectedTableId) {
      setCartItems([]);
      setDiscountType('flat');
      setDiscountValue('');
      setActiveOrder(null);
      setPaymentMethod('cash');
      setCashReceived('');
      setPaymentNote('');
      resetOnlineDraft();
      setIsLoadingTableOrder(false);
      return undefined;
    }

    let isCurrent = true;

    const loadActiveOrder = async () => {
      setIsLoadingTableOrder(true);
      setSubmitError(null);
      setSubmitSuccess(null);

      try {
        const targetOrderId = pinnedOrderId || requestedOrderId;
        const response = targetOrderId
          ? await orderAPI.getOrder(targetOrderId)
          : await orderAPI.getActiveOrderForTable(selectedTableId);
        const currentOrder = response.data?.data || null;

        if (!isCurrent) {
          return;
        }

        if (currentOrder) {
          applyOrderToWorkspace(currentOrder);

          if (requestedOrderId) {
            const nextSearchParams = new URLSearchParams(window.location.search);
            nextSearchParams.delete('orderId');
            setSearchParams(nextSearchParams, { replace: true });
          }
        } else {
          setCartItems([]);
          setDiscountType('flat');
          setDiscountValue('');
          setPaymentMethod('cash');
          setCashReceived('');
          setPaymentNote('');
          setPinnedOrderId('');
          resetOnlineDraft();
        }
      } catch (error) {
        if (!isCurrent) {
          return;
        }

        setActiveOrder(null);
        setCartItems([]);
        setDiscountType('flat');
        setDiscountValue('');
        setPaymentMethod('cash');
        setCashReceived('');
        setPaymentNote('');
        setPinnedOrderId('');
        resetOnlineDraft();
        setSubmitError(error.response?.data?.message || 'Failed to load the current table bill.');
      } finally {
        if (isCurrent) {
          setIsLoadingTableOrder(false);
        }
      }
    };

    loadActiveOrder();

    return () => {
      isCurrent = false;
    };
  }, [orderType, pinnedOrderId, requestedOrderId, selectedTableId, setSearchParams]);

  useEffect(() => {
    if (!requestedOrderId || orderType === 'dine-in') {
      return undefined;
    }

    let isCurrent = true;

    const loadRequestedOrder = async () => {
      setSubmitError(null);
      setSubmitSuccess(null);

      try {
        const response = await orderAPI.getOrder(requestedOrderId);
        const requestedOrder = response.data?.data || null;

        if (!isCurrent || !requestedOrder) {
          return;
        }

        applyOrderToWorkspace(requestedOrder);
      } catch (error) {
        if (!isCurrent) {
          return;
        }

        setSubmitError(error.response?.data?.message || 'Failed to load the requested order.');
      }
    };

    loadRequestedOrder();

    return () => {
      isCurrent = false;
    };
  }, [orderType, requestedOrderId]);

  const subtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price * item.qty, 0),
    [cartItems]
  );

  const discountAmount = useMemo(() => {
    const numericDiscount = Number(discountValue || 0);
    if (!numericDiscount || numericDiscount < 0) {
      return 0;
    }

    if (discountType === 'percent') {
      return Math.min(subtotal, (subtotal * Math.min(numericDiscount, 100)) / 100);
    }

    return Math.min(subtotal, numericDiscount);
  }, [discountType, discountValue, subtotal]);

  const finalTotal = useMemo(
    () => Math.max(0, Number((subtotal - discountAmount).toFixed(2))),
    [discountAmount, subtotal]
  );

  const isEditingActiveBill = Boolean(activeOrder?.id);
  const cashReceivedAmount = useMemo(
    () => (cashReceived === '' ? null : Number(cashReceived)),
    [cashReceived]
  );
  const changeDue = useMemo(
    () =>
      paymentMethod === 'cash' && Number.isFinite(cashReceivedAmount)
        ? Math.max(0, Number((cashReceivedAmount - finalTotal).toFixed(2)))
        : 0,
    [cashReceivedAmount, finalTotal, paymentMethod]
  );
  const shortfallAmount = useMemo(
    () =>
      paymentMethod === 'cash' && Number.isFinite(cashReceivedAmount)
        ? Math.max(0, Number((finalTotal - cashReceivedAmount).toFixed(2)))
        : finalTotal,
    [cashReceivedAmount, finalTotal, paymentMethod]
  );
  const cartSignature = useMemo(() => createItemsSignature(cartItems), [cartItems]);
  const activeOrderSignature = useMemo(
    () => createItemsSignature(activeOrder?.items || []),
    [activeOrder]
  );
  const onlineDraftSignature = useMemo(
    () =>
      createOnlineDraftSignature({
        orderType,
        source: onlineSource,
        promisedAt,
        paymentState: onlinePaymentState,
        customerName,
        customerPhone,
        customerAddress,
        channelOrderId,
      }),
    [channelOrderId, customerAddress, customerName, customerPhone, onlinePaymentState, onlineSource, orderType, promisedAt]
  );
  const activeOrderOnlineSignature = useMemo(
    () =>
      createOnlineDraftSignature({
        orderType: activeOrder?.orderType || (activeOrder?.tableId ? 'dine-in' : ''),
        source: activeOrder?.online?.source || 'direct',
        promisedAt: formatDateTimeInputValue(activeOrder?.online?.promisedAt),
        paymentState: activeOrder?.online?.paymentState || 'pending',
        customerName: activeOrder?.online?.customerName || '',
        customerPhone: activeOrder?.online?.customerPhone || '',
        customerAddress: activeOrder?.online?.customerAddress || '',
        channelOrderId: activeOrder?.online?.channelOrderId || '',
      }),
    [activeOrder]
  );
  const hasUnsavedChanges = useMemo(() => {
    if (!isEditingActiveBill) {
      return false;
    }

    const savedTotal = Number(activeOrder?.totalAmount ?? activeOrder?.total ?? 0);
    return (
      (activeOrder?.orderType || (activeOrder?.tableId ? 'dine-in' : '')) !== orderType ||
      cartSignature !== activeOrderSignature ||
      onlineDraftSignature !== activeOrderOnlineSignature ||
      Math.abs(savedTotal - finalTotal) > 0.009 ||
      normalizePaymentMethod(activeOrder?.paymentMethod) !== paymentMethod
    );
  }, [
    activeOrder,
    activeOrderOnlineSignature,
    activeOrderSignature,
    cartSignature,
    finalTotal,
    isEditingActiveBill,
    onlineDraftSignature,
    orderType,
    paymentMethod,
  ]);
  const latestKitchenTicket = useMemo(() => getLatestKitchenTicket(activeOrder), [activeOrder]);
  const editingCartItem = useMemo(
    () => cartItems.find((item) => item.id === editingItemId) || null,
    [cartItems, editingItemId]
  );
  const shouldShowBlockingTableLoader = isLoadingTableOrder && !activeOrder && cartItems.length === 0;

  const syncBillingSearchParams = ({ tableId = '', orderId = '' } = {}) => {
    const nextSearchParams = new URLSearchParams(window.location.search);

    if (tableId) {
      nextSearchParams.set('tableId', tableId);
    } else {
      nextSearchParams.delete('tableId');
    }

    if (orderId) {
      nextSearchParams.set('orderId', orderId);
    } else {
      nextSearchParams.delete('orderId');
    }

    setSearchParams(nextSearchParams, { replace: true });
  };

  const resetOnlineDraft = () => {
    setOnlineSource('direct');
    setPromisedAt('');
    setOnlinePaymentState('pending');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setChannelOrderId('');
  };

  const applyOrderToWorkspace = (order) => {
    if (!order) {
      return;
    }

    const restoredDraft = buildDraftFromOrder(order);
    const restoredOnlineDraft = normalizeOnlineDraft(order);

    setActiveOrder(order);
    setPinnedOrderId(order.id || '');
    setOrderType(order.orderType || (order.tableId ? 'dine-in' : 'delivery'));
    setSelectedTableId(order.tableId || '');
    setCartItems(restoredDraft.cartItems);
    setDiscountType(restoredDraft.discountType);
    setDiscountValue(restoredDraft.discountValue);
    setPaymentMethod(restoredDraft.paymentMethod);
    setCashReceived('');
    setPaymentNote('');
    setOnlineSource(restoredOnlineDraft.source);
    setPromisedAt(restoredOnlineDraft.promisedAt);
    setOnlinePaymentState(restoredOnlineDraft.paymentState);
    setCustomerName(restoredOnlineDraft.customerName);
    setCustomerPhone(restoredOnlineDraft.customerPhone);
    setCustomerAddress(restoredOnlineDraft.customerAddress);
    setChannelOrderId(restoredOnlineDraft.channelOrderId);
    syncBillingSearchParams({
      tableId: order.tableId || '',
      orderId: order.id || '',
    });
  };

  const refreshOnlineInbox = async () => {
    setIsLoadingOnlineInbox(true);
    setOnlineInboxError('');

    try {
      const response = await orderAPI.getOnlineInbox();
      setOnlineInbox(response.data?.data || []);
    } catch (error) {
      setOnlineInbox([]);
      setOnlineInboxError(error.response?.data?.message || 'Failed to load online order inbox.');
    } finally {
      setIsLoadingOnlineInbox(false);
    }
  };

  const clearBillDraft = () => {
    setCartItems([]);
    setDiscountType('flat');
    setDiscountValue('');
    setActiveOrder(null);
    setPaymentMethod('cash');
    setCashReceived('');
    setPaymentNote('');
    setShowCancelModal(false);
    setCancelReason('');
    setEditingItemId('');
    setShowItemDetailsModal(false);
    setItemNoteDraft('');
    setItemModifiersDraft('');
    resetOnlineDraft();
  };

  const handleOrderTypeChange = (nextOrderType) => {
    if (nextOrderType === orderType) {
      return;
    }

    setOrderType(nextOrderType);
    setSubmitError(null);
    setSubmitSuccess(null);

    if (nextOrderType !== 'dine-in') {
      setPinnedOrderId('');
      setSelectedTableId('');
      clearBillDraft();
      syncBillingSearchParams();
    }
  };

  const handleSelectTable = (tableId) => {
    setPinnedOrderId('');
    setSelectedTableId(tableId);
    syncBillingSearchParams({ tableId });
    setSubmitError(null);
    setSubmitSuccess(null);
  };

  const handleChangeTable = () => {
    setPinnedOrderId('');
    setSelectedTableId('');
    clearBillDraft();
    syncBillingSearchParams();
    setSubmitError(null);
    setSubmitSuccess(null);
  };

  const handleChangeType = () => {
    setPinnedOrderId('');
    setOrderType('');
    setSelectedTableId('');
    clearBillDraft();
    syncBillingSearchParams();
    setSubmitError(null);
    setSubmitSuccess(null);
  };

  const handleAddItem = (item) => {
    setSubmitError(null);
    setSubmitSuccess(null);
    setCartItems((current) => {
      const existingItem = current.find((cartItem) => cartItem.id === item.id);
      if (existingItem) {
        return current.map((cartItem) =>
          cartItem.id === item.id ? { ...cartItem, qty: cartItem.qty + 1 } : cartItem
        );
      }

      return [...current, { id: item.id, name: item.name, price: item.price, qty: 1 }];
    });
  };

  const handleIncreaseQty = (itemId) => {
    setCartItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, qty: item.qty + 1 } : item))
    );
  };

  const handleDecreaseQty = (itemId) => {
    setCartItems((current) =>
      current
        .map((item) => (item.id === itemId ? { ...item, qty: item.qty - 1 } : item))
        .filter((item) => item.qty > 0)
    );
  };

  const handleRemoveItem = (itemId) => {
    setCartItems((current) => current.filter((item) => item.id !== itemId));
  };

  const handleOpenItemDetails = (itemId) => {
    const targetItem = cartItems.find((item) => item.id === itemId);
    if (!targetItem) {
      return;
    }

    setEditingItemId(itemId);
    setItemNoteDraft(targetItem.itemNote || '');
    setItemModifiersDraft((targetItem.modifiers || []).join(', '));
    setShowItemDetailsModal(true);
  };

  const handleSaveItemDetails = () => {
    if (!editingItemId) {
      return;
    }

    setCartItems((current) =>
      current.map((item) =>
        item.id === editingItemId
          ? {
              ...item,
              itemNote: itemNoteDraft.trim(),
              modifiers: parseModifiersInput(itemModifiersDraft),
            }
          : item
      )
    );
    setShowItemDetailsModal(false);
    setEditingItemId('');
    setItemNoteDraft('');
    setItemModifiersDraft('');
  };

  const getItemQuantity = (itemId) => cartItems.find((item) => item.id === itemId)?.qty || 0;

  const validateDraftBeforeSave = () => {
    if (cartItems.length === 0) {
      setSubmitError('Add at least one item before saving the bill.');
      return false;
    }

    if (orderType === 'dine-in' && !selectedTableId) {
      setSubmitError('Select a table for dine-in billing.');
      return false;
    }

    if (orderType !== 'dine-in' && !onlineSource) {
      setSubmitError('Choose the order source before saving this online order.');
      return false;
    }

    return true;
  };

  const validateSettlement = () => {
    if (!validateDraftBeforeSave()) {
      return false;
    }

    if (paymentMethod === 'cash') {
      if (!Number.isFinite(cashReceivedAmount)) {
        setSubmitError('Enter the cash received amount before settling the bill.');
        return false;
      }

      if (cashReceivedAmount < finalTotal) {
        setSubmitError('Cash received must be at least the bill total before settlement.');
        return false;
      }
    }

    return true;
  };

  const buildOrderPayload = () => ({
    items: cartItems.map((item) => ({
      id: item.id,
      name: item.name,
      qty: item.qty,
      price: item.price,
      itemNote: item.itemNote || '',
      modifiers: item.modifiers || [],
    })),
    total: finalTotal,
    order_type: orderType,
    table_id: orderType === 'dine-in' ? selectedTableId : null,
    paymentMethod,
    source: orderType === 'dine-in' ? null : onlineSource,
    promisedAt: orderType === 'dine-in' ? null : serializePromisedAt(promisedAt),
    paymentState: orderType === 'dine-in' ? null : onlinePaymentState,
    customerName: orderType === 'dine-in' ? '' : customerName.trim(),
    customerPhone: orderType === 'dine-in' ? '' : customerPhone.trim(),
    customerAddress: orderType === 'dine-in' ? '' : customerAddress.trim(),
    channelOrderId: orderType === 'dine-in' ? '' : channelOrderId.trim(),
  });

  const handleSubmit = async () => {
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!validateDraftBeforeSave()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = buildOrderPayload();
      const response = isEditingActiveBill
        ? await orderAPI.updateOrder(activeOrder.id, payload)
        : await orderAPI.createOrder(payload);

      const savedOrder = response.data?.data;
      applyOrderToWorkspace(savedOrder);
      refreshOnlineInbox();

      setSubmitSuccess(
        `${formatDisplayOrderNumber(savedOrder)} saved successfully. Continue editing or settle when the guest is ready.`
      );
    } catch (error) {
      setSubmitError(
        error.response?.data?.message || `Failed to ${isEditingActiveBill ? 'update' : 'create'} order.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendToKitchen = async () => {
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!validateDraftBeforeSave()) {
      return;
    }

    setIsSendingToKitchen(true);

    try {
      let orderForKitchen = activeOrder;

      if (!isEditingActiveBill) {
        const createResponse = await orderAPI.createOrder(buildOrderPayload());
        orderForKitchen = createResponse.data?.data;
      } else if (hasUnsavedChanges) {
        const updateResponse = await orderAPI.updateOrder(activeOrder.id, buildOrderPayload());
        orderForKitchen = updateResponse.data?.data;
      }

      const sendResponse = await orderAPI.sendToKitchen(orderForKitchen.id);
      const result = sendResponse.data?.data || {};
      const updatedOrder = result.order || orderForKitchen;
      const kitchenTicket = result.ticket || null;
      applyOrderToWorkspace(updatedOrder);
      refreshOnlineInbox();

      const didOpenPrint = kitchenTicket ? printKitchenTicket(kitchenTicket, {
        title: `${kitchenTicket.displayOrderNumber || 'KOT'}${kitchenTicket.tableNumber ? ` - Table ${kitchenTicket.tableNumber}` : ''}`,
      }) : false;

      setSubmitSuccess(
        didOpenPrint
          ? `${formatDisplayOrderNumber(updatedOrder)} sent to kitchen. Print slip opened for KOT ${kitchenTicket?.sequence || ''}.`
          : `${formatDisplayOrderNumber(updatedOrder)} sent to kitchen successfully.`
      );
    } catch (error) {
      setSubmitError(error.response?.data?.message || 'Failed to send this bill to kitchen.');
    } finally {
      setIsSendingToKitchen(false);
    }
  };

  const handleSettle = async () => {
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!validateSettlement()) {
      return;
    }

    setIsSettling(true);

    try {
      let orderToSettle = activeOrder;

      if (!isEditingActiveBill) {
        const createResponse = await orderAPI.createOrder(buildOrderPayload());
        orderToSettle = createResponse.data?.data;
      } else if (hasUnsavedChanges) {
        const updateResponse = await orderAPI.updateOrder(activeOrder.id, buildOrderPayload());
        orderToSettle = updateResponse.data?.data;
      }

      const settleResponse = await orderAPI.settleOrder(orderToSettle.id, {
        paymentMethod,
        amountReceived: paymentMethod === 'cash' ? cashReceivedAmount : undefined,
        paymentNote: paymentNote.trim(),
      });
      const settledOrder = settleResponse.data?.data;
      const formattedOrderNumber = formatDisplayOrderNumber(settledOrder || orderToSettle);
      const settlementChangeDue = Number(settledOrder?.settlement?.changeDue || 0);

      clearBillDraft();
      setPinnedOrderId('');
      setOrderType('');
      setSelectedTableId('');
      syncBillingSearchParams();
      refreshOnlineInbox();
      setSubmitSuccess(
        settlementChangeDue > 0
          ? `${formattedOrderNumber} settled via ${paymentMethod.toUpperCase()}. Return ${formatCurrency(settlementChangeDue)} change.`
          : `${formattedOrderNumber} settled successfully via ${paymentMethod.toUpperCase()}.`
      );
    } catch (error) {
      setSubmitError(error.response?.data?.message || 'Failed to settle the bill.');
    } finally {
      setIsSettling(false);
    }
  };

  const handleCancelBill = async () => {
    if (!activeOrder?.id) {
      return;
    }

    const trimmedReason = cancelReason.trim();
    if (!trimmedReason) {
      setSubmitError('Add a reason before cancelling the bill.');
      return;
    }

    setIsCancelling(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      await orderAPI.updateStatus(activeOrder.id, {
        status: 'cancelled',
        cancelReason: trimmedReason,
      });

      clearBillDraft();
      setPinnedOrderId('');
      setOrderType('');
      setSelectedTableId('');
      syncBillingSearchParams();
      refreshOnlineInbox();
      setCancelReason('');
      setShowCancelModal(false);
      setSubmitSuccess(`${formatDisplayOrderNumber(activeOrder)} cancelled successfully.`);
    } catch (error) {
      setSubmitError(error.response?.data?.message || 'Failed to cancel the bill.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleCreateOnlineOrder = () => {
    setPinnedOrderId('');
    setSelectedTableId('');
    clearBillDraft();
    setOrderType('delivery');
    setSubmitError(null);
    setSubmitSuccess('Started a fresh online order. Add items, set source and promise time, then save or send to kitchen.');
    syncBillingSearchParams();
  };

  const handleOpenOnlineOrder = (order) => {
    applyOrderToWorkspace(order);
    setSubmitError(null);
    setSubmitSuccess(`${formatDisplayOrderNumber(order)} opened in the POS workspace.`);
  };

  const handleUpdateOnlineWorkflow = async (order, workflowStatus) => {
    setUpdatingOnlineOrderId(order.id);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const response = await orderAPI.updateOnlineOrder(order.id, {
        workflowStatus,
      });
      const updatedOrder = response.data?.data || order;

      if (activeOrder?.id === updatedOrder.id) {
        applyOrderToWorkspace(updatedOrder);
      }

      await refreshOnlineInbox();
      setSubmitSuccess(`${formatDisplayOrderNumber(updatedOrder)} marked ${workflowStatus.replace(/_/g, ' ')}.`);
    } catch (error) {
      setSubmitError(error.response?.data?.message || 'Failed to update the online order workflow.');
    } finally {
      setUpdatingOnlineOrderId('');
    }
  };

  const shouldChooseTableFirst = orderType === 'dine-in' && !selectedTableId;
  const shouldChooseServiceModeFirst = !orderType;

  const serviceModes = [
    {
      id: 'dine-in',
      label: 'Dine-In',
      description: 'Waiter selects a table, then takes the order.',
      icon: Utensils,
    },
    {
      id: 'takeaway',
      label: 'Takeaway',
      description: 'Direct menu entry without table selection.',
      icon: ShoppingBag,
    },
    {
      id: 'delivery',
      label: 'Delivery',
      description: 'Take order quickly for delivery billing.',
      icon: Bike,
    },
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-[2rem] border border-[var(--border-color)] bg-[linear-gradient(135deg,var(--color-primary-soft),rgba(255,255,255,0.02))] p-5 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-secondary)]">Point Of Sale</p>
            <h1 className="mt-2 text-3xl font-bold text-[var(--text-primary)]">Fast Billing</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
              Waiter-first flow: choose a table, reopen the running bill if one already exists, keep saving changes on
              the same bill, send clean KOT actions to kitchen, and settle cleanly with cash or UPI when the guest is
              ready to pay.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-[1.5rem] bg-[var(--bg-card)] px-4 py-3">
              <div className="flex items-center gap-3">
                <Store className="h-5 w-5 text-[var(--color-primary)]" />
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">Available Items</p>
                  <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">{items.length}</p>
                </div>
              </div>
            </div>
            <div className="rounded-[1.5rem] bg-[var(--bg-card)] px-4 py-3">
              <div className="flex items-center gap-3">
                <TableProperties className="h-5 w-5 text-[var(--color-primary)]" />
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">Tables</p>
                  <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">{tables.length}</p>
                </div>
              </div>
            </div>
            <div className="rounded-[1.5rem] bg-[var(--bg-card)] px-4 py-3">
              <div className="flex items-center gap-3">
                <Receipt className="h-5 w-5 text-[var(--color-primary)]" />
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">Cart Lines</p>
                  <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">{cartItems.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <OnlineOrderInbox
        orders={onlineInbox}
        loading={isLoadingOnlineInbox}
        selectedOrderId={activeOrder?.id || ''}
        updatingOrderId={updatingOnlineOrderId}
        onOpenOrder={handleOpenOnlineOrder}
        onCreateOrder={handleCreateOnlineOrder}
        onRefresh={refreshOnlineInbox}
        onUpdateWorkflow={handleUpdateOnlineWorkflow}
      />

      {onlineInboxError ? (
        <section className="rounded-[1.6rem] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {onlineInboxError}
        </section>
      ) : null}

      {shouldChooseServiceModeFirst ? (
        <section className="rounded-[2rem] border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-card)]">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)]">Step 1</p>
            <h2 className="mt-2 text-2xl font-bold text-[var(--text-primary)]">Choose service type</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Start with how the order is being taken. If it is dine-in, we will ask for the table next.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {serviceModes.map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => {
                    handleOrderTypeChange(mode.id);
                  }}
                  className="rounded-[1.7rem] border border-[var(--border-color)] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5 text-left shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--bg-card-muted)] text-[var(--color-primary)]">
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="rounded-full bg-[var(--bg-card-muted)] px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-primary)]">
                      Start
                    </span>
                  </div>

                  <h3 className="mt-5 text-2xl font-black text-[var(--text-primary)]">{mode.label}</h3>
                  <p className="mt-2 text-sm font-medium text-[var(--text-secondary)]">{mode.description}</p>
                </button>
              );
            })}
          </div>
        </section>
      ) : shouldChooseTableFirst ? (
        <section className="rounded-[2rem] border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-card)]">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)]">Step 2</p>
              <h2 className="mt-2 text-2xl font-bold text-[var(--text-primary)]">Select table for the waiter order</h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Pick a table first. After that, the menu opens so the waiter can take the order.
              </p>
            </div>

            <button
              type="button"
              onClick={handleChangeType}
              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--color-primary-soft)]"
            >
              <ArrowLeft className="h-4 w-4" />
              Change Service Type
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {tables.map((table) => (
              <button
                key={table.id}
                type="button"
                onClick={() => handleSelectTable(table.id)}
                className="rounded-[1.7rem] border border-[var(--border-color)] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5 text-left shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">Table</p>
                    <h3 className="mt-2 text-3xl font-black text-[var(--text-primary)]">{table.tableNumber}</h3>
                  </div>
                  <span className="rounded-full bg-[var(--bg-card-muted)] px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-primary)]">
                    {table.status || 'available'}
                  </span>
                </div>

                <p className="mt-5 text-sm font-medium text-[var(--text-secondary)]">
                  Tap to open menu for this table.
                </p>
              </button>
            ))}
          </div>
        </section>
      ) : shouldShowBlockingTableLoader ? (
        <section className="flex min-h-[24rem] items-center justify-center rounded-[2rem] border border-[var(--border-color)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-card)]">
          <div className="text-center">
            <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <Loader className="h-8 w-8 animate-spin" />
            </div>
            <p className="mt-5 text-lg font-bold text-[var(--text-primary)]">
              Opening Table {selectedTable?.tableNumber || ''}
            </p>
            <p className="mt-2 max-w-md text-sm text-[var(--text-secondary)]">
              Checking for a running bill so the waiter can continue the same order without creating duplicates.
            </p>
          </div>
        </section>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(24rem,0.95fr)]">
          <div className="space-y-5">
            {orderType === 'dine-in' && selectedTable ? (
              <div className="flex flex-col gap-4 rounded-[1.6rem] border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-4 shadow-[var(--shadow-card)] lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                    {orderType.replace('-', ' ')}
                  </p>
                  <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">Table {selectedTable.tableNumber}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${
                        activeOrder?.status === 'awaiting_waiter_approval'
                          ? 'bg-sky-500/12 text-sky-700 dark:text-sky-300'
                          : isEditingActiveBill
                            ? 'bg-amber-500/12 text-amber-600 dark:text-amber-300'
                            : 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-300'
                      }`}
                    >
                      {activeOrder?.status === 'awaiting_waiter_approval'
                        ? 'Customer Order Waiting'
                        : isEditingActiveBill
                          ? 'Running Bill Reopened'
                          : 'New Bill'}
                    </span>
                    {isEditingActiveBill ? (
                      <span className="rounded-full bg-[var(--bg-card-muted)] px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-primary)]">
                        {formatDisplayOrderNumber(activeOrder)}
                      </span>
                    ) : null}
                  </div>
                  <p className="max-w-2xl text-sm text-[var(--text-secondary)]">
                    {activeOrder?.status === 'awaiting_waiter_approval'
                      ? `${activeOrder.items?.length || 0} customer-selected lines are waiting for waiter approval. Review them, make any changes you need, then approve and send the kitchen ticket.`
                      : isEditingActiveBill
                        ? `${activeOrder.items?.length || 0} saved lines loaded. Keep updating this same bill, and send only the real kitchen delta when new items are added.`
                        : 'No active order yet for this table. Start a fresh running bill, send it to kitchen when ready, and settle it when the guest is ready to pay.'}
                  </p>
                  {isEditingActiveBill ? (
                    <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-[var(--text-secondary)]">
                      <span>Status: <span className="text-[var(--text-primary)]">{formatOrderStatusLabel(activeOrder.status)}</span></span>
                      <span>Total so far: <span className="text-[var(--text-primary)]">{formatCurrency(activeOrder.totalAmount || 0)}</span></span>
                      <span>Payment: <span className="text-[var(--text-primary)]">{activeOrder.paymentStatus || 'unpaid'}</span></span>
                      {isLoadingTableOrder ? (
                        <span className="inline-flex items-center gap-2 text-[var(--color-primary)]">
                          <Loader className="h-4 w-4 animate-spin" />
                          Refreshing bill
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {latestKitchenTicket ? (
                    <div className="rounded-[1.1rem] border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-100">
                      Latest KOT: #{latestKitchenTicket.sequence} • {latestKitchenTicket.type} • {latestKitchenTicket.summary || 'Kitchen action created'}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleChangeTable}
                    className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--color-primary-soft)]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Change Table
                  </button>
                  <button
                    type="button"
                    onClick={handleChangeType}
                    className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--color-primary-soft)]"
                  >
                    Change Type
                  </button>
                </div>
              </div>
            ) : orderType ? (
              <div className="flex flex-col gap-4 rounded-[1.6rem] border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-4 shadow-[var(--shadow-card)] lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">Service Type</p>
                  <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">
                    {orderType === 'takeaway' ? 'Takeaway' : 'Delivery'}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {orderType !== 'dine-in' ? (
                      <span className="rounded-full bg-[var(--bg-card-muted)] px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-primary)]">
                        {onlineSource || 'direct'}
                      </span>
                    ) : null}
                    {activeOrder?.id ? (
                      <span className="rounded-full bg-[var(--bg-card-muted)] px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-primary)]">
                        {formatDisplayOrderNumber(activeOrder)}
                      </span>
                    ) : null}
                    {activeOrder?.online?.workflowStatus ? (
                      <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-amber-300">
                        {activeOrder.online.workflowStatus.replace(/_/g, ' ')}
                      </span>
                    ) : null}
                  </div>
                  {orderType !== 'dine-in' ? (
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm font-semibold text-[var(--text-secondary)]">
                      <span>Promise: <span className="text-[var(--text-primary)]">{promisedAt ? promisedAt.replace('T', ' ') : 'Not set'}</span></span>
                      <span>Channel payment: <span className="text-[var(--text-primary)]">{onlinePaymentState}</span></span>
                      {customerName ? (
                        <span>Customer: <span className="text-[var(--text-primary)]">{customerName}</span></span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={handleChangeType}
                  className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--color-primary-soft)]"
                >
                  Change Type
                </button>
              </div>
            ) : null}

            <MenuPanel
              categories={categories}
              activeCategoryId={activeCategoryId}
              onCategoryChange={setActiveCategoryId}
              onAddItem={handleAddItem}
              onIncreaseItem={handleIncreaseQty}
              onDecreaseItem={handleDecreaseQty}
              getItemQuantity={getItemQuantity}
              loading={menuLoading}
              error={menuError}
            />
          </div>

          <div className="flex min-h-[40rem] flex-col gap-5">
            <OrderControls
              orderType={orderType}
              onOrderTypeChange={handleOrderTypeChange}
              selectedTable={selectedTable}
              selectedTableId={selectedTableId}
              onChangeTable={handleChangeTable}
              discountType={discountType}
              onDiscountTypeChange={setDiscountType}
              discountValue={discountValue}
              onDiscountValueChange={setDiscountValue}
            />

            <OnlineOrderDetailsPanel
              orderType={orderType}
              source={onlineSource}
              promisedAt={promisedAt}
              paymentState={onlinePaymentState}
              customerName={customerName}
              customerPhone={customerPhone}
              customerAddress={customerAddress}
              channelOrderId={channelOrderId}
              onSourceChange={setOnlineSource}
              onPromisedAtChange={setPromisedAt}
              onPaymentStateChange={setOnlinePaymentState}
              onCustomerNameChange={setCustomerName}
              onCustomerPhoneChange={setCustomerPhone}
              onCustomerAddressChange={setCustomerAddress}
              onChannelOrderIdChange={setChannelOrderId}
              disabled={isLoadingTableOrder || isSubmitting || isSettling || isSendingToKitchen}
            />

            <PaymentPanel
              paymentMethod={paymentMethod}
              onPaymentMethodChange={setPaymentMethod}
              totalAmount={finalTotal}
              cashReceived={cashReceived}
              onCashReceivedChange={setCashReceived}
              changeDue={changeDue}
              shortfallAmount={shortfallAmount}
              paymentNote={paymentNote}
              onPaymentNoteChange={setPaymentNote}
              activeOrder={activeOrder}
              disabled={isLoadingTableOrder || isSubmitting || isSettling}
            />

            <div className="min-h-0 flex-1">
              <CartPanel
                items={cartItems}
                subtotal={subtotal}
                discountAmount={discountAmount}
                finalTotal={finalTotal}
                onIncrease={handleIncreaseQty}
                onDecrease={handleDecreaseQty}
                onRemove={handleRemoveItem}
                onEditDetails={handleOpenItemDetails}
                onSubmit={handleSubmit}
                onSendToKitchen={handleSendToKitchen}
                onSettle={handleSettle}
                onCancel={isEditingActiveBill ? () => setShowCancelModal(true) : null}
                isSubmitting={isSubmitting}
                isSendingToKitchen={isSendingToKitchen}
                isSettling={isSettling}
                isCancelling={isCancelling}
                error={submitError}
                success={submitSuccess}
                submitLabel={isEditingActiveBill ? 'SAVE CHANGES' : 'SAVE RUNNING BILL'}
                sendToKitchenLabel={
                  activeOrder?.status === 'awaiting_waiter_approval'
                    ? hasUnsavedChanges
                      ? 'SAVE & APPROVE FOR KITCHEN'
                      : 'APPROVE & SEND TO KITCHEN'
                    : isEditingActiveBill
                      ? hasUnsavedChanges
                        ? 'SAVE & SEND TO KITCHEN'
                        : 'SEND TO KITCHEN'
                      : 'CREATE & SEND TO KITCHEN'
                }
                settleLabel={
                  isEditingActiveBill
                    ? hasUnsavedChanges
                      ? 'SAVE & SETTLE BILL'
                      : 'SETTLE BILL'
                    : 'CREATE & SETTLE BILL'
                }
                cancelLabel="CANCEL BILL"
                isSubmitDisabled={isLoadingTableOrder}
                isSendToKitchenDisabled={isLoadingTableOrder}
                isSettleDisabled={isLoadingTableOrder || (paymentMethod === 'cash' && shortfallAmount > 0)}
                isCancelDisabled={isLoadingTableOrder || !isEditingActiveBill}
              />
            </div>
          </div>
        </div>
      )}

      <Modal
        title={editingCartItem ? `Line Details • ${editingCartItem.name}` : 'Line Details'}
        isOpen={showItemDetailsModal}
        onClose={() => {
          setShowItemDetailsModal(false);
          setEditingItemId('');
          setItemNoteDraft('');
          setItemModifiersDraft('');
        }}
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <div className="rounded-[1.4rem] border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 py-3 text-sm text-[var(--text-secondary)]">
            Add item-level notes and modifiers so kitchen sees exactly what changed on the next KOT.
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">Item Note</span>
            <textarea
              value={itemNoteDraft}
              onChange={(event) => setItemNoteDraft(event.target.value)}
              placeholder="Example: no onion, extra crisp, serve first."
              className="min-h-[110px] w-full resize-y rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--color-primary)]"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">Modifiers</span>
            <input
              value={itemModifiersDraft}
              onChange={(event) => setItemModifiersDraft(event.target.value)}
              placeholder="Example: extra cheese, spicy, half plate"
              className="w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--color-primary)]"
            />
          </label>

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setShowItemDetailsModal(false);
                setEditingItemId('');
                setItemNoteDraft('');
                setItemModifiersDraft('');
              }}
              className="min-h-[3.5rem] w-full rounded-[1.3rem] border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--color-primary-soft)] sm:flex-1"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSaveItemDetails}
              className="min-h-[3.5rem] w-full rounded-[1.3rem] bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition hover:opacity-95 sm:flex-1"
            >
              Save Details
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        title={activeOrder ? `Cancel ${formatDisplayOrderNumber(activeOrder)}` : 'Cancel Bill'}
        isOpen={showCancelModal}
        onClose={() => {
          if (isCancelling) {
            return;
          }

          setShowCancelModal(false);
          setCancelReason('');
        }}
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <div className="rounded-[1.4rem] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            Cancelling a bill marks it as closed and removes it from the running-bill flow for this table.
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">Cancellation Reason</span>
            <textarea
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Example: guest left, wrong table selected, bill created by mistake."
              className="min-h-[110px] w-full resize-y rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--color-primary)]"
            />
          </label>

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setShowCancelModal(false);
                setCancelReason('');
              }}
              disabled={isCancelling}
              className="min-h-[3.5rem] w-full rounded-[1.3rem] border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--color-primary-soft)] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1"
            >
              Keep Bill
            </button>
            <button
              type="button"
              onClick={handleCancelBill}
              disabled={isCancelling}
              className="min-h-[3.5rem] w-full rounded-[1.3rem] bg-[#dc2626] px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-1"
            >
              {isCancelling ? 'Cancelling...' : 'Confirm Cancel'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
