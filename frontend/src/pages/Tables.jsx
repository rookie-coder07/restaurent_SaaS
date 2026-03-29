import { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  Download,
  Edit2,
  Loader,
  Plus,
  QrCode,
  Receipt,
  TableProperties,
  Trash2,
  Users,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { orderAPI, tableAPI } from '../services/apiEndpoints';
import { useAuthStore } from '../context/authStore';
import QRCodeModal from '../components/QRCodeModal';
import { generateBulkQRCodes } from '../utils/qrCodeGenerator';
import { formatCurrency, formatDate } from '../utils/formatters';
import { formatDisplayOrderNumber } from '../utils/formatters';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import Toast from '../components/common/Toast';
import EmptyState from '../components/common/EmptyState';
import StatCard from '../components/common/StatCard';

const ACTIVE_ORDER_STATUSES = new Set(['awaiting_waiter_approval', 'pending', 'preparing', 'ready', 'served']);

const TABLE_STATUS_META = {
  available: {
    label: 'Available',
    card: 'border-emerald-500/20 bg-emerald-500/8',
    badge: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  occupied: {
    label: 'Order Going On',
    card: 'border-rose-500/20 bg-rose-500/8',
    badge: 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300',
    dot: 'bg-rose-500',
  },
  reserved: {
    label: 'Reserved',
    card: 'border-amber-500/20 bg-amber-500/8',
    badge: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
};

function getEffectiveTableStatus(table, activeOrders) {
  if ((activeOrders || []).length > 0) {
    return 'occupied';
  }

  if (table.status === 'reserved' || table.reservedBy) {
    return 'reserved';
  }

  return 'available';
}

export default function Tables() {
  const location = useLocation();
  const navigate = useNavigate();
  const userRole = useAuthStore((state) => state.user?.role);
  const currentPortal = location.pathname.startsWith('/admin') ? 'admin' : 'pos';
  const canManageTableConfig = userRole === 'owner';
  const canOpenBilling = currentPortal === 'pos';
  const {
    data: tablesData = {},
    loading: tablesLoading,
    error: tablesError,
    refetch: refetchTables,
  } = useApi(() => tableAPI.getTables({ limit: 200 }));
  const {
    data: openBillsData = [],
    loading: openBillsLoading,
    error: openBillsError,
    refetch: refetchOrders,
  } = useApi(() => orderAPI.getOpenBills());

  const [showForm, setShowForm] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedTableForQR, setSelectedTableForQR] = useState(null);
  const [showReservationForm, setShowReservationForm] = useState(false);
  const [reservationTable, setReservationTable] = useState(null);
  const [formData, setFormData] = useState({
    tableNumber: '',
    seatCapacity: '',
    location: '',
  });
  const [reservationData, setReservationData] = useState({
    reservedBy: '',
    reservationTime: '',
  });

  const tables = useMemo(
    () => [...(tablesData?.tables || [])].sort((a, b) => Number(a.tableNumber || 0) - Number(b.tableNumber || 0)),
    [tablesData]
  );
  const orders = Array.isArray(openBillsData) ? openBillsData : [];

  const activeOrdersByTableId = useMemo(() => {
    const map = new Map();

    orders
      .filter((order) => ACTIVE_ORDER_STATUSES.has(order.status) && order.paymentStatus !== 'paid')
      .forEach((order) => {
        if (!order.tableId) {
          return;
        }

        const existing = map.get(order.tableId) || [];
        existing.push(order);
        map.set(order.tableId, existing);
      });

    return map;
  }, [orders]);

  const enrichedTables = useMemo(
    () =>
      tables.map((table) => {
        const activeOrders = activeOrdersByTableId.get(table.id) || [];
        const currentOrder = [...activeOrders].sort(
          (left, right) =>
            new Date(right.updatedAt || right.createdAt || 0) -
            new Date(left.updatedAt || left.createdAt || 0)
        )[0] || null;

        return {
          ...table,
          activeOrders,
          currentOrder,
          effectiveStatus: getEffectiveTableStatus(table, activeOrders),
        };
      }),
    [activeOrdersByTableId, tables]
  );

  const selectedTableData = useMemo(
    () => enrichedTables.find((table) => table.id === selectedTable?.id) || selectedTable,
    [enrichedTables, selectedTable]
  );

  const availableCount = enrichedTables.filter((table) => table.effectiveStatus === 'available').length;
  const occupiedCount = enrichedTables.filter((table) => table.effectiveStatus === 'occupied').length;
  const reservedCount = enrichedTables.filter((table) => table.effectiveStatus === 'reserved').length;
  const loadError = tablesError || openBillsError || null;

  const resetTableForm = () => {
    setFormData({
      tableNumber: '',
      seatCapacity: '',
      location: '',
    });
    setEditingTable(null);
    setShowForm(false);
  };

  const openCreateForm = () => {
    setError(null);
    setEditingTable(null);
    setFormData({
      tableNumber: '',
      seatCapacity: '',
      location: '',
    });
    setShowForm(true);
  };

  const openEditForm = (table) => {
    setError(null);
    setEditingTable(table);
    setFormData({
      tableNumber: table.tableNumber,
      seatCapacity: table.seatCapacity,
      location: table.location || '',
    });
    setShowForm(true);
  };

  const syncData = async () => {
    await Promise.all([refetchTables(), refetchOrders()]);
  };

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      syncData().catch(() => {
        // Toast state is already handled by request flows when needed.
      });
    }, 8000);

    return () => window.clearInterval(intervalId);
  }, [refetchOrders, refetchTables]);

  const openBilling = (table, order = null) => {
    if (!canOpenBilling) {
      setError('Open billing from the POS portal to continue with this table.');
      return;
    }

    const searchParams = new URLSearchParams({
      tableId: table.id,
    });

    if (order?.id) {
      searchParams.set('orderId', order.id);
    }

    setSelectedTable(null);
    navigate(`/pos?${searchParams.toString()}`);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const payload = {
        tableNumber: Number(formData.tableNumber),
        seatCapacity: Number(formData.seatCapacity),
        location: formData.location.trim(),
      };

      if (editingTable) {
        await tableAPI.updateTable(editingTable.id, payload);
        setSuccess('Table updated successfully');
      } else {
        await tableAPI.createTable(payload);
        setSuccess('Table created successfully');
      }

      resetTableForm();
      await syncData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Failed to save table');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTable = async (tableId) => {
    if (!confirm('Delete this table?')) {
      return;
    }

    try {
      await tableAPI.deleteTable(tableId);
      setSelectedTable((current) => (current?.id === tableId ? null : current));
      setSuccess('Table deleted successfully');
      await syncData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to delete table');
    }
  };

  const handleOpenReservation = (table) => {
    setReservationTable(table);
    setReservationData({
      reservedBy: table.reservedBy || '',
      reservationTime: table.reservationTime ? new Date(table.reservationTime).toISOString().slice(0, 16) : '',
    });
    setShowReservationForm(true);
  };

  const handleReserveTable = async (event) => {
    event.preventDefault();
    if (!reservationTable) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await tableAPI.reserveTable(reservationTable.id, {
        reservedBy: reservationData.reservedBy,
        reservationTime: new Date(reservationData.reservationTime).toISOString(),
      });
      setSuccess('Table reserved successfully');
      setShowReservationForm(false);
      setReservationTable(null);
      await syncData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to reserve table');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReleaseTable = async (tableId) => {
    try {
      await tableAPI.releaseTable(tableId);
      setSuccess('Table released successfully');
      await syncData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to release table');
    }
  };

  const handleShowQRCode = (table) => {
    setSelectedTableForQR(table);
    setShowQRModal(true);
  };

  const handleBulkExportQR = async () => {
    if (enrichedTables.length === 0) {
      setError('No tables to export');
      return;
    }

    try {
      setSuccess('Generating QR codes...');
      await generateBulkQRCodes(enrichedTables, 'Your Restaurant');
      setSuccess('QR codes generated successfully');
    } catch {
      setError('Failed to export QR codes');
    }
  };

  if (tablesLoading || openBillsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {success ? <Toast type="success" message={success} /> : null}
      {error ? <Toast type="error" message={error} /> : null}

      {loadError ? (
        <Card className="border border-rose-500/20 bg-rose-500/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-200">Data Load Issue</p>
              <p className="mt-2 text-sm font-medium text-rose-100">
                {tablesError
                  ? `Tables could not be loaded: ${tablesError}`
                  : `Open bill data could not be loaded: ${openBillsError}`}
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                syncData().catch(() => {
                  // Error state is surfaced above.
                });
              }}
            >
              Retry
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.16),_transparent_35%),var(--color-surface)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--color-text-subtle)]">Tables</p>
            <h1 className="mt-3 text-3xl font-bold text-[var(--color-text)]">Live floor view</h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--color-text-muted)]">
              See tables in order, tap any table to check reservation status, active orders, and what is currently being served.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            {canManageTableConfig && enrichedTables.length > 0 ? (
              <Button variant="secondary" onClick={handleBulkExportQR}>
                <Download className="h-4 w-4" />
                Export All QR
              </Button>
            ) : null}
            {canManageTableConfig ? (
              <Button onClick={openCreateForm}>
                <Plus className="h-4 w-4" />
                Add Table
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Available" value={availableCount} subtitle="Ready for guests" tone="success" />
        <StatCard label="Order Going On" value={occupiedCount} subtitle="Tables with active KOT/orders" tone="neutral" />
        <StatCard label="Reserved" value={reservedCount} subtitle="Booked for later" tone="primary" />
      </div>

      {enrichedTables.length === 0 ? (
        loadError ? (
          <EmptyState
            icon={TableProperties}
            title="Unable to load tables"
            description={loadError}
            action={(
              <Button
                onClick={() => {
                  syncData().catch(() => {
                    // Error state is surfaced above.
                  });
                }}
              >
                Retry
              </Button>
            )}
          />
        ) : (
          <EmptyState
            icon={TableProperties}
            title="No tables configured"
            description="Create your first table to start managing the floor."
            action={canManageTableConfig ? (
              <Button onClick={openCreateForm}>
                <Plus className="h-4 w-4" />
                Create First Table
              </Button>
            ) : null}
          />
        )
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {enrichedTables.map((table) => {
            const meta = TABLE_STATUS_META[table.effectiveStatus] || TABLE_STATUS_META.available;
            const duplicateBillCount = Math.max(0, table.activeOrders.length - 1);

            return (
              <button
                key={table.id}
                type="button"
                onClick={() => setSelectedTable(table)}
                className={`rounded-[1.8rem] border p-4 text-left shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-floating)] ${meta.card} ${
                  selectedTableData?.id === table.id ? 'ring-2 ring-[var(--color-primary)]' : 'border-[var(--border-color)]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)]">Table</p>
                    <h2 className="mt-2 text-3xl font-black text-[var(--text-primary)]">{table.tableNumber}</h2>
                  </div>
                  <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${meta.badge}`}>
                    <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                    {meta.label}
                  </span>
                </div>

                <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-secondary)]">Seats</span>
                    <span className="font-semibold text-[var(--text-primary)]">{table.seatCapacity}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-secondary)]">Location</span>
                    <span className="truncate pl-3 font-semibold text-[var(--text-primary)]">{table.location || 'Floor'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-secondary)]">Running Bill</span>
                    <span className="truncate pl-3 font-semibold text-[var(--text-primary)]">
                      {table.currentOrder ? formatDisplayOrderNumber(table.currentOrder) : 'None'}
                    </span>
                  </div>
                  {duplicateBillCount > 0 ? (
                    <p className="text-xs font-medium text-amber-600 dark:text-amber-300">
                      {duplicateBillCount} more open bill{duplicateBillCount > 1 ? 's' : ''} need review
                    </p>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Modal
        title={selectedTableData ? `Table ${selectedTableData.tableNumber}` : 'Table Details'}
        isOpen={Boolean(selectedTableData)}
        onClose={() => setSelectedTable(null)}
        maxWidth="max-w-3xl"
      >
        {selectedTableData ? (
          <TableDetails
            table={selectedTableData}
            onOpenBilling={(order) => openBilling(selectedTableData, order)}
            onReserve={() => handleOpenReservation(selectedTableData)}
            onRelease={() => handleReleaseTable(selectedTableData.id)}
            onEdit={() => {
              setSelectedTable(null);
              openEditForm(selectedTableData);
            }}
            onShowQR={() => handleShowQRCode(selectedTableData)}
            onDelete={() => {
              setSelectedTable(null);
              handleDeleteTable(selectedTableData.id);
            }}
            canManageTableConfig={canManageTableConfig}
            canOpenBilling={canOpenBilling}
          />
        ) : null}
      </Modal>

      {showQRModal && selectedTableForQR ? (
        <QRCodeModal
          table={selectedTableForQR}
          restaurantName="Your Restaurant"
          onClose={() => {
            setShowQRModal(false);
            setSelectedTableForQR(null);
          }}
        />
      ) : null}

      {canManageTableConfig ? (
        <Modal
          title={editingTable ? 'Edit Table' : 'Add New Table'}
          isOpen={showForm}
          onClose={() => {
            resetTableForm();
            setError(null);
          }}
          maxWidth="max-w-lg"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Table Number"
              type="number"
              value={formData.tableNumber}
              onChange={(event) => setFormData({ ...formData, tableNumber: event.target.value })}
              min="1"
              required
            />
            <Input
              label="Seat Capacity"
              type="number"
              value={formData.seatCapacity}
              onChange={(event) => setFormData({ ...formData, seatCapacity: event.target.value })}
              min="1"
              max="20"
              required
            />
            <Input
              label="Location"
              value={formData.location}
              onChange={(event) => setFormData({ ...formData, location: event.target.value })}
              placeholder="Window, patio, private room..."
            />

            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Button type="button" variant="secondary" className="w-full sm:flex-1" onClick={resetTableForm}>
                Cancel
              </Button>
              <Button type="submit" className="w-full sm:flex-1" disabled={submitting}>
                {submitting ? <Loader className="h-4 w-4 animate-spin" /> : null}
                {editingTable ? 'Update Table' : 'Create Table'}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      <Modal
        title={reservationTable ? `Reserve Table ${reservationTable.tableNumber}` : 'Reserve Table'}
        isOpen={showReservationForm}
        onClose={() => {
          setShowReservationForm(false);
          setReservationTable(null);
        }}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleReserveTable} className="space-y-4">
          <Input
            label="Reserved By"
            value={reservationData.reservedBy}
            onChange={(event) => setReservationData({ ...reservationData, reservedBy: event.target.value })}
            required
          />
          <Input
            label="Reservation Time"
            type="datetime-local"
            value={reservationData.reservationTime}
            onChange={(event) => setReservationData({ ...reservationData, reservationTime: event.target.value })}
            required
          />
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:flex-1"
              onClick={() => {
                setShowReservationForm(false);
                setReservationTable(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" className="w-full sm:flex-1" disabled={submitting}>
              {submitting ? <Loader className="h-4 w-4 animate-spin" /> : null}
              Reserve Table
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function TableDetails({
  table,
  onOpenBilling,
  onReserve,
  onRelease,
  onEdit,
  onShowQR,
  onDelete,
  canManageTableConfig = false,
  canOpenBilling = true,
}) {
  const statusMeta = TABLE_STATUS_META[table.effectiveStatus] || TABLE_STATUS_META.available;
  const activeOrders = [...(table.activeOrders || [])].sort(
    (left, right) =>
      new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0)
  );
  const currentOrder = activeOrders[0] || null;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <div className={`rounded-[1.6rem] border p-4 ${statusMeta.card}`}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">Status</p>
          <div className={`mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-bold ${statusMeta.badge}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${statusMeta.dot}`} />
            {statusMeta.label}
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-[var(--border-color)] bg-[var(--color-panel)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">Seats</p>
          <p className="mt-3 text-2xl font-black text-[var(--text-primary)]">{table.seatCapacity}</p>
        </div>

        <div className="rounded-[1.6rem] border border-[var(--border-color)] bg-[var(--color-panel)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">Location</p>
          <p className="mt-3 text-lg font-bold text-[var(--text-primary)]">{table.location || 'Floor'}</p>
        </div>
      </div>

      {table.reservedBy ? (
        <div className="rounded-[1.6rem] border border-amber-500/25 bg-amber-500/10 p-4">
          <div className="flex items-center gap-3">
            <CalendarClock className="h-5 w-5 text-amber-600 dark:text-amber-300" />
            <div>
              <p className="font-bold text-[var(--text-primary)]">Reserved for {table.reservedBy}</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {table.reservationTime ? formatDate(table.reservationTime) : 'Reservation time not set'}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-[1.75rem] border border-[var(--border-color)] bg-[var(--color-panel)] p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">Current Running Bill</p>
            <h3 className="mt-2 text-xl font-black text-[var(--text-primary)]">
              {currentOrder ? formatDisplayOrderNumber(currentOrder) : 'No active order'}
            </h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {currentOrder
                ? 'Reopen this bill in POS to update items or settle payment.'
                : 'Start billing for this table from the POS screen.'}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">Open Bills</p>
              <p className="mt-2 text-2xl font-black text-[var(--text-primary)]">{activeOrders.length}</p>
            </div>
            {canOpenBilling ? (
              <Button onClick={() => onOpenBilling(currentOrder)}>
                <Receipt className="h-4 w-4" />
                {currentOrder ? 'Reopen Bill' : 'Start Billing'}
              </Button>
            ) : (
              <p className="max-w-xs text-right text-xs font-medium text-[var(--text-secondary)]">
                Open the POS portal to bill this table.
              </p>
            )}
          </div>
        </div>

        {currentOrder ? (
          <div className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <InfoChip icon={Receipt} label="Status" value={currentOrder.status} />
              <InfoChip icon={CalendarClock} label="Created" value={formatDate(currentOrder.createdAt)} />
              <InfoChip icon={Users} label="Bill Total" value={formatCurrency(currentOrder.totalAmount || 0)} />
            </div>

            <div className="rounded-[1.35rem] border border-[var(--border-color)] bg-[var(--color-surface)] p-4">
              <p className="text-sm font-bold text-[var(--text-primary)]">Current order items</p>
              <div className="mt-3 space-y-3">
                {(currentOrder.items || []).map((item, index) => (
                  <div key={`${currentOrder.id}-${item.menuItemId || index}`} className="flex items-start justify-between gap-3">
                    <p className="min-w-0 flex-1 break-words text-[var(--text-primary)]">
                      <span className="font-bold">{item.quantity}x</span> {item.name}
                    </p>
                    <span className="shrink-0 text-sm font-semibold text-[var(--text-secondary)]">
                      {formatCurrency((item.unitPrice || item.price || 0) * (item.quantity || 0))}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.35rem] border border-[var(--border-color)] bg-[var(--color-surface)] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-[var(--text-primary)]">Open bill queue</p>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                  {activeOrders.length} bill{activeOrders.length === 1 ? '' : 's'}
                </p>
              </div>

              <div className="mt-3 space-y-3">
                {activeOrders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-[1.2rem] border border-[var(--border-color)] bg-[var(--color-panel)] p-3"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[var(--text-primary)]">
                          {formatDisplayOrderNumber(order)}
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-secondary)]">
                          {formatDate(order.updatedAt || order.createdAt)} • {order.status} • {order.paymentStatus || 'unpaid'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {formatCurrency(order.totalAmount || 0)}
                        </p>
                        {canOpenBilling ? (
                          <Button variant="secondary" onClick={() => onOpenBilling(order)}>
                            Open Bill
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-[1.35rem] border border-dashed border-[var(--border-color)] bg-[var(--color-surface)] px-4 py-8 text-center text-sm font-medium text-[var(--text-secondary)]">
            No order is going on for this table right now.
          </div>
        )}
      </div>

      <div className={`grid gap-3 ${canManageTableConfig ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-2'}`}>
        {table.effectiveStatus === 'reserved' ? (
          <Button variant="secondary" onClick={onRelease} className="w-full">
            Release
          </Button>
        ) : (
          <Button variant="secondary" onClick={onReserve} className="w-full">
            Reserve
          </Button>
        )}

        {canManageTableConfig ? (
          <Button variant="secondary" onClick={onShowQR} className="w-full">
            <QrCode className="h-4 w-4" />
            QR
          </Button>
        ) : null}

        {canManageTableConfig ? (
          <Button variant="secondary" onClick={onEdit} className="w-full">
            <Edit2 className="h-4 w-4" />
            Edit
          </Button>
        ) : null}

        {canManageTableConfig ? (
          <Button variant="danger" onClick={onDelete} className="w-full">
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function InfoChip({ icon: Icon, label, value }) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--border-color)] bg-[var(--color-surface)] p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 text-sm font-bold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}
