import { Loader, Plus, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApi } from '../hooks/useApi';
import useAutoRefresh from '../hooks/useAutoRefresh';
import { menuAPI, orderAPI, tableAPI } from '../services/apiEndpoints';
import { formatCurrency, formatDate, formatDisplayOrderNumber } from '../utils/formatters';
import { getOrderAgeMinutes, getOrderSourceLabel, isDelayedOrder } from '../utils/managerPortal';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import Toast from '../components/common/Toast';
import PaginationControls from '../components/common/PaginationControls';
import useResponsivePagination from '../hooks/useResponsivePagination';

const STATUS_FLOW = ['awaiting_waiter_approval', 'pending', 'preparing', 'ready', 'served'];

export default function ManagerOrders() {
  const { data: ordersData = {}, loading, execute: reloadOrders, refetch: refetchOrders } = useApi(() => orderAPI.getOrders({ limit: 150 }));
  const { data: menuData = {}, refetch: refetchMenu } = useApi(() => menuAPI.getItems({ limit: 200 }));
  const { data: tablesData = {}, refetch: refetchTables } = useApi(() => tableAPI.getTables({ limit: 200 }));
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [draftItems, setDraftItems] = useState([]);
  const [newOrderTableId, setNewOrderTableId] = useState('');
  const [updatingOrderId, setUpdatingOrderId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const orders = ordersData?.items || [];
  const menuItems = menuData?.items || [];
  const tables = tablesData?.tables || [];
  const allOrders = useMemo(
    () => [...orders].sort((left, right) => new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0)),
    [orders]
  );
  const {
    paginatedItems: paginatedOrders,
    currentPage,
    totalPages,
    canGoPrevious,
    canGoNext,
    goPrevious,
    goNext,
    hasPagination,
  } = useResponsivePagination(allOrders, { mobileItemsPerPage: 6, desktopItemsPerPage: 10 });

  useAutoRefresh(() => Promise.allSettled([refetchOrders(), refetchMenu(), refetchTables()]), 12000);

  const updateStatus = async (orderId, status) => {
    setUpdatingOrderId(orderId);
    setError('');

    try {
      await orderAPI.updateStatus(orderId, { status });
      setSuccess(`Order moved to ${status}.`);
      await reloadOrders();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to update order status.');
    } finally {
      setUpdatingOrderId('');
    }
  };

  const openOrderDetails = async (order) => {
    setSelectedOrder(order);
    setSelectedOrderDetails(order);
    setDetailsLoading(true);
    setError('');

    try {
      const response = await orderAPI.getOrder(order.id);
      setSelectedOrderDetails(response.data?.data || order);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to load order details.');
      setSelectedOrderDetails(order);
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeOrderDetails = () => {
    setSelectedOrder(null);
    setSelectedOrderDetails(null);
    setDetailsLoading(false);
  };

  const createQuickOrder = async () => {
    if (!newOrderTableId || draftItems.length === 0) {
      setError('Pick a table and add at least one item.');
      return;
    }

    setUpdatingOrderId('new-order');
    setError('');

    try {
      await orderAPI.createOrder({
        tableId: newOrderTableId,
        items: draftItems.map((item) => ({
          menuItemId: item.menuItemId || item.id,
          quantity: Number(item.quantity || 0),
          unitPrice: Number(item.unitPrice || item.price || 0),
        })),
        totalAmount: draftItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || item.price || 0), 0),
      });
      setSuccess('Quick order created.');
      setNewOrderOpen(false);
      setDraftItems([]);
      setNewOrderTableId('');
      await reloadOrders();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to create quick order.');
    } finally {
      setUpdatingOrderId('');
    }
  };

  const addMenuItemToDraft = (menuItem) => {
    setDraftItems((current) => {
      const existing = current.find((item) => (item.menuItemId || item.id) === menuItem.id);
      if (existing) {
        return current.map((item) =>
          (item.menuItemId || item.id) === menuItem.id
            ? { ...item, quantity: Number(item.quantity || 0) + 1 }
            : item
        );
      }

      return [
        ...current,
        {
          ...menuItem,
          menuItemId: menuItem.id,
          unitPrice: Number(menuItem.price || 0),
          quantity: 1,
        },
      ];
    });
  };

  const changeDraftQuantity = (itemId, quantity) => {
    if (quantity <= 0) {
      setDraftItems((current) => current.filter((item) => (item.menuItemId || item.id) !== itemId));
      return;
    }

    setDraftItems((current) =>
      current.map((item) =>
        (item.menuItemId || item.id) === itemId ? { ...item, quantity } : item
      )
    );
  };

  if (loading && allOrders.length === 0) {
    return <div className="flex h-full items-center justify-center"><Loader className="h-8 w-8 animate-spin text-[var(--color-primary)]" /></div>;
  }

  return (
    <div className="space-y-6">
      {success ? <Toast type="success" message={success} /> : null}
      {error ? <Toast type="error" message={error} /> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={() => reloadOrders()}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
        <Button onClick={() => { setNewOrderOpen(true); setDraftItems([]); }}>
          <Plus className="h-4 w-4" />
          Quick Add Order
        </Button>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        {paginatedOrders.map((order) => {
          const currentIndex = STATUS_FLOW.indexOf(order.status);
          const nextStatus = currentIndex >= 0 ? STATUS_FLOW[currentIndex + 1] || '' : '';

          return (
            <Card key={order.id} className="p-3">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-subtle)]">{formatDisplayOrderNumber(order)}</p>
                      <span className="rounded-full bg-[var(--color-surface-muted)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-secondary)]">{getOrderSourceLabel(order)}</span>
                    </div>
                    <h2 className="mt-1 text-base font-bold text-[var(--color-text)]">Table {order.tableNumber || 'Walk-in'}</h2>
                    <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{formatDate(order.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="rounded-full bg-[var(--color-surface-muted)] px-2.5 py-1 text-xs font-semibold capitalize text-[var(--color-text)]">{order.status}</p>
                    <p className={`mt-1 text-xs font-medium ${isDelayedOrder(order) ? 'text-red-400' : 'text-[var(--color-text-muted)]'}`}>
                      {getOrderAgeMinutes(order.createdAt)} mins open
                    </p>
                  </div>
                </div>

                <div className="rounded-xl bg-[var(--color-surface-muted)] px-3 py-2.5">
                  <div className="space-y-1.5">
                    {(order.items || []).slice(0, 2).map((item, index) => (
                      <div key={`${order.id}-${index}`} className="flex items-start justify-between gap-3 text-xs">
                        <p className="line-clamp-1 text-[var(--color-text)]">{item.quantity}x {item.name}</p>
                        <span className="shrink-0 text-[var(--color-text-muted)]">{formatCurrency((item.unitPrice || item.price || 0) * (item.quantity || 0))}</span>
                      </div>
                    ))}
                    {(order.items || []).length > 2 ? (
                      <p className="text-[11px] font-medium text-[var(--color-text-muted)]">
                        +{(order.items || []).length - 2} more item(s)
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {STATUS_FLOW.map((status) => (
                    <button
                      key={`${order.id}-${status}`}
                      type="button"
                      disabled={updatingOrderId === order.id || order.status === 'cancelled' || order.status === 'completed'}
                      onClick={() => updateStatus(order.id, status)}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                        order.status === status
                          ? 'bg-[var(--color-primary)] text-white'
                          : 'bg-[var(--color-surface-muted)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => openOrderDetails(order)}>View</Button>
                    {nextStatus ? (
                      <Button size="sm" onClick={() => updateStatus(order.id, nextStatus)} disabled={updatingOrderId === order.id}>
                        {updatingOrderId === order.id ? 'Updating...' : `Move to ${nextStatus}`}
                      </Button>
                    ) : null}
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-semibold text-[var(--color-text)]">{formatCurrency(order.totalAmount || order.total || 0)}</p>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">{order.paymentStatus || 'unpaid'}</p>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {hasPagination ? (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          canGoPrevious={canGoPrevious}
          canGoNext={canGoNext}
          onPrevious={goPrevious}
          onNext={goNext}
        />
      ) : null}

      <Modal title={selectedOrder ? formatDisplayOrderNumber(selectedOrder) : 'Order details'} isOpen={Boolean(selectedOrder)} onClose={closeOrderDetails} maxWidth="max-w-lg">
        {selectedOrder ? (
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-text-muted)]">Created {formatDate((selectedOrderDetails || selectedOrder).createdAt)}</p>
            {detailsLoading ? (
              <div className="flex min-h-[10rem] items-center justify-center rounded-2xl bg-[var(--color-surface-muted)]">
                <Loader className="h-6 w-6 animate-spin text-[var(--color-primary)]" />
              </div>
            ) : (
              <>
                {((selectedOrderDetails || selectedOrder).items || []).map((item, index) => (
                  <div key={`${selectedOrder.id}-detail-${index}`} className="flex items-start justify-between gap-3 rounded-2xl bg-[var(--color-surface-muted)] p-3">
                    <div className="min-w-0">
                      <p className="text-[var(--color-text)]">{item.quantity}x {item.name}</p>
                      {item.modifiers?.length ? <p className="mt-1 text-xs text-[var(--color-text-muted)]">{item.modifiers.join(', ')}</p> : null}
                      {item.note ? <p className="mt-1 text-xs text-[var(--color-text-muted)]">Note: {item.note}</p> : null}
                    </div>
                    <span className="text-[var(--color-text-muted)]">{formatCurrency((item.unitPrice || item.price || 0) * (item.quantity || 0))}</span>
                  </div>
                ))}
                <div className="rounded-2xl border border-[var(--color-border)] p-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-[var(--color-text-muted)]">Payment</span>
                    <span className="font-semibold text-[var(--color-text)]">{(selectedOrderDetails || selectedOrder).paymentStatus || 'unpaid'}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                    <span className="text-[var(--color-text-muted)]">Total</span>
                    <span className="font-semibold text-[var(--color-text)]">{formatCurrency((selectedOrderDetails || selectedOrder).totalAmount || (selectedOrderDetails || selectedOrder).total || 0)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : null}
      </Modal>

      <Modal title="Quick Add Order" isOpen={newOrderOpen} onClose={() => setNewOrderOpen(false)} maxWidth="max-w-4xl">
        <div className="space-y-5">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">Table</span>
            <select value={newOrderTableId} onChange={(event) => setNewOrderTableId(event.target.value)} className="input">
              <option value="">Select table</option>
              {tables.map((table) => (
                <option key={table.id} value={table.id}>Table {table.tableNumber}</option>
              ))}
            </select>
          </label>
          <div className="grid gap-5 lg:grid-cols-[1fr,1fr]">
            <Card className="p-4">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Menu items</p>
              <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
                {menuItems.map((item) => (
                  <button
                    key={`new-${item.id}`}
                    type="button"
                    onClick={() => addMenuItemToDraft(item)}
                    className="flex w-full items-center justify-between rounded-2xl bg-[var(--color-surface-muted)] px-4 py-3 text-left"
                  >
                    <span className="font-semibold text-[var(--text-primary)]">{item.name}</span>
                    <span className="text-sm text-[var(--text-secondary)]">{formatCurrency(item.price || 0)}</span>
                  </button>
                ))}
              </div>
            </Card>
            <Card className="p-4">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Draft order</p>
              <div className="mt-4 space-y-3">
                {draftItems.map((item) => (
                  <div key={`draft-${item.menuItemId || item.id}`} className="rounded-2xl bg-[var(--color-surface-muted)] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-[var(--text-primary)]">{item.name}</p>
                      <input
                        type="number"
                        min="0"
                        value={item.quantity}
                        onChange={(event) => changeDraftQuantity(item.menuItemId || item.id, Number(event.target.value))}
                        className="input max-w-[100px]"
                      />
                    </div>
                  </div>
                ))}
                <div className="rounded-2xl border border-[var(--border-color)] p-4">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    Draft total: {formatCurrency(draftItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || item.price || 0), 0))}
                  </p>
                </div>
                <Button className="w-full" onClick={createQuickOrder} disabled={updatingOrderId === 'new-order'}>
                  {updatingOrderId === 'new-order' ? 'Creating...' : 'Create Quick Order'}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </Modal>

    </div>
  );
}
