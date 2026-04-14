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
import { orderAPI, tableAPI } from '../services/apiEndpoints';
import { useAuthStore } from '../context/authStore';
import { useManagerStore } from '../context/managerStore';
import { usePosStore } from '../context/posStore';
import { useOrderSubscription } from '../hooks/useOrderSubscription';
import { getTableActivity } from '../utils/managerPortal';
import QRCodeModal from '../components/QRCodeModal';
import { generateBulkQRCodes } from '../utils/qrCodeGenerator';
import { compareTableLabels, formatCurrency, formatDate } from '../utils/formatters';
import { formatDisplayOrderNumber } from '../utils/formatters';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import Toast from '../components/common/Toast';
import EmptyState from '../components/common/EmptyState';
import StatCard from '../components/common/StatCard';
import PaginationControls from '../components/common/PaginationControls';
import useResponsivePagination from '../hooks/useResponsivePagination';
import { playLoudBuzzer } from '../utils/alerts';
import { subscribeToOrderEvents, subscribeToTableEvents } from '../utils/liveOrderEvents';

const TABLE_STATUS_META = {
  open: {
    label: 'Available',
    card: 'border-emerald-500/20 bg-emerald-500/8',
    badge: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  busy: {
    label: 'In Use',
    card: 'border-rose-500/20 bg-rose-500/8',
    badge: 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300',
    dot: 'bg-rose-500',
  },
  manual: {
    label: 'Manual',
    card: 'border-sky-500/20 bg-sky-500/8',
    badge: 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300',
    dot: 'bg-sky-500',
  },
  qr_locked: {
    label: 'QR Locked',
    card: 'border-fuchsia-500/20 bg-fuchsia-500/8',
    badge: 'border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300',
    dot: 'bg-fuchsia-500',
  },
  reserved: {
    label: 'Reserved',
    card: 'border-amber-500/20 bg-amber-500/8',
    badge: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  closed: {
    label: 'Closed',
    card: 'border-slate-500/20 bg-slate-500/10',
    badge: 'border-slate-500/25 bg-slate-500/10 text-slate-700 dark:text-slate-300',
    dot: 'bg-slate-500',
  },
};

export default function Tables() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);
  const restaurantId = useAuthStore((state) => state.restaurantId);
  const userRole = useAuthStore((state) => state.user?.role);
  const currentPortal = location.pathname.startsWith('/admin') ? 'admin' : 'pos';
  const canManageTableConfig = userRole === 'owner';
  const canOpenBilling = currentPortal === 'pos';
  const tablesData = usePosStore((state) => state.tableData);
  const openBillsData = usePosStore((state) => state.openBillsData);
  const tablesLoading = usePosStore((state) => state.tableLoading);
  const openBillsLoading = usePosStore((state) => state.openBillsLoading);
  const tablesError = usePosStore((state) => state.tableError);
  const openBillsError = usePosStore((state) => state.openBillsError);
  const preloadCoreData = usePosStore((state) => state.preloadCoreData);
  const refreshTableOverview = usePosStore((state) => state.refreshTableOverview);
  const setPendingBillingTarget = usePosStore((state) => state.setPendingBillingTarget);
  const tableAssignments = useManagerStore((state) => state.tableAssignments);
  const tableClosures = useManagerStore((state) => state.tableClosures);
  const tableTransfers = useManagerStore((state) => state.tableTransfers);
  const tableMerges = useManagerStore((state) => state.tableMerges);

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
  const [tableView, setTableView] = useState('all'); // all | assigned

  const tables = useMemo(
    () => {
      if (!tablesData || !Array.isArray(tablesData?.tables)) {
        return [];
      }
      return [...tablesData.tables].sort((a, b) => compareTableLabels(a.tableNumber, b.tableNumber));
    },
    [tablesData]
  );
  const orders = useMemo(
    () => {
      if (!openBillsData || !Array.isArray(openBillsData)) {
        return [];
      }
      return openBillsData;
    },
    [openBillsData]
  );

  const enrichedTables = useMemo(
    () =>
      tables.map((table) => {
        const tableActivity = getTableActivity(
          table,
          orders,
          tableAssignments,
          tableClosures,
          tableTransfers,
          tableMerges,
          tables
        );
        const currentOrder = [...(tableActivity.activeOrders || [])].sort(
          (left, right) =>
            new Date(right.updatedAt || right.createdAt || 0) -
            new Date(left.updatedAt || left.createdAt || 0)
        )[0] || null;

        return {
          ...tableActivity,
          currentOrder,
        };
      }),
    [orders, tableAssignments, tableClosures, tableMerges, tableTransfers, tables]
  );

  const visibleTables = useMemo(
    () => {
      const baseTables = enrichedTables.filter((table) => !table.isMergedSecondary);
      if (currentPortal === 'pos' && userRole === 'staff') {
        const assignedTableIds = Array.isArray(currentUser?.assignedTables) ? currentUser.assignedTables : [];

        if (tableView === 'assigned') {
          return baseTables.filter((table) => assignedTableIds.includes(table.id));
        }

        return baseTables;
      }

      return baseTables;
    },
    [currentPortal, currentUser?.assignedTables, enrichedTables, tableView, userRole]
  );

  const selectedTableData = useMemo(
    () => visibleTables.find((table) => table.id === selectedTable?.id) || selectedTable,
    [selectedTable, visibleTables]
  );

  const availableCount = visibleTables.filter((table) => table.effectiveStatus === 'open').length;
  const occupiedCount = visibleTables.filter((table) => ['busy', 'manual', 'qr_locked'].includes(table.effectiveStatus)).length;
  const reservedCount = visibleTables.filter((table) => table.effectiveStatus === 'reserved').length;
  const loadError = tablesError || openBillsError || null;
  const {
    paginatedItems: paginatedTables,
    currentPage,
    totalPages,
    canGoPrevious,
    canGoNext,
    goPrevious,
    goNext,
    hasPagination,
  } = useResponsivePagination(visibleTables, { mobileItemsPerPage: 8, desktopItemsPerPage: 18 });

  const resetTableForm = () => {
    setFormData({
      tableNumber: '',
      seatCapacity: '',
      location: editingTable?.location || '',
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
    if (!restaurantId) {
      return;
    }

    await Promise.all([
      preloadCoreData({ force: true }),
      refreshTableOverview({ force: true }),
    ]);
  };

  useEffect(() => {
    if (!restaurantId) {
      return;
    }

    preloadCoreData().catch(() => {
      // Shared store errors are already exposed in UI state.
    });
    refreshTableOverview().catch(() => {
      // Shared store errors are already exposed in UI state.
    });
  }, [restaurantId]);

  useOrderSubscription(restaurantId, (payload) => {
    if (!restaurantId) {
      return;
    }

    const order = payload?.new || {};
    const tableId = order.table_id || order.tableId;
    const orderType = String(order.order_type || order.orderType || '').toLowerCase();
    const assignedTableIds = Array.isArray(currentUser?.assignedTables) ? currentUser.assignedTables : [];

    if (orderType === 'qr' && tableId && assignedTableIds.includes(tableId)) {
      playLoudBuzzer('waiter');
    }

    refreshTableOverview({ force: true, silent: true }).catch(() => {
      // Shared store errors are already surfaced in the page state.
    });
  });

  useEffect(() => {
    if (!restaurantId) {
      return undefined;
    }

    const cleanup = subscribeToOrderEvents(() => {
      refreshTableOverview({ force: true, silent: true }).catch(() => {});
    });

    return cleanup;
  }, [refreshTableOverview, restaurantId]);

  // 📊 Subscribe to table updates (when orders are deleted, tables are freed)
  useEffect(() => {
    if (!restaurantId) {
      return undefined;
    }

    const cleanup = subscribeToTableEvents((tableUpdate) => {
      // Refresh tables when a table status is updated (e.g., freed from order deletion)
      refreshTableOverview({ force: true, silent: true }).catch(() => {});
    });

    return cleanup;
  }, [refreshTableOverview, restaurantId]);

  // Fallback periodic refresh to clear stale busy states even if SSE misses an event
  useEffect(() => {
    if (!restaurantId) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      refreshTableOverview({ force: true, silent: true }).catch(() => {});
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [refreshTableOverview, restaurantId]);

  const openBilling = (table, order = null) => {
    if (!table?.id) {
      setError('Table ID is invalid. Unable to open billing.');
      return;
    }

    if (!canOpenBilling) {
      setError('Open billing from the POS portal to continue with this table.');
      return;
    }

    if (table.isClosed || table.effectiveStatus === 'closed') {
      setError('This table is closed in the manager workspace. Reopen it before billing.');
      return;
    }

    const activeOrder = order || (table.activeOrders || [])[0] || null;
    const searchParams = new URLSearchParams({
      tableId: table.id,
    });

    if (activeOrder?.id) {
      searchParams.set('orderId', activeOrder.id);
    }

    setPendingBillingTarget({
      tableId: table.id,
      orderId: activeOrder?.id || '',
      message: activeOrder ? 'Table is currently in use. Opened the existing bill.' : '',
    });
    setSelectedTable(null);
    // ✅ FIX: Pass tableId via URL so it's immediately available
    navigate(`/pos/billing?${searchParams.toString()}`);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const payload = {
        tableNumber: String(formData.tableNumber || '').trim(),
        seatCapacity: Number(formData.seatCapacity),
      };

      const normalizedLocation = (editingTable?.location || formData.location || '').trim();
      if (normalizedLocation) {
        payload.location = normalizedLocation;
      }

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

  const shouldShowInitialLoader =
    (tablesLoading || openBillsLoading) &&
    !(tablesData?.tables || []).length &&
    !orders.length;

  if (shouldShowInitialLoader) {
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
                  : openBillsError
                    ? `Failed to load bill`
                    : 'Failed to load data'}
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

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
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

      {currentPortal === 'pos' && userRole === 'staff' ? (
        <div className="flex flex-wrap gap-2 rounded-[1.1rem] border border-[var(--border-color)] bg-[var(--color-panel)] p-2">
          <Button
            variant={tableView === 'all' ? 'primary' : 'secondary'}
            onClick={() => setTableView('all')}
          >
            All Tables
          </Button>
          <Button
            variant={tableView === 'assigned' ? 'primary' : 'secondary'}
            onClick={() => setTableView('assigned')}
          >
            QR Assigned Tables
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Available" value={availableCount} subtitle="Ready for guests" tone="success" />
        <StatCard label="In Use" value={occupiedCount} subtitle="Tables with active bills" tone="neutral" />
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
            title={currentPortal === 'pos' && userRole === 'staff' ? 'No tables assigned' : 'No tables configured'}
            description={
              currentPortal === 'pos' && userRole === 'staff'
                ? 'This waiter account has no assigned tables yet. Ask the owner to assign table numbers from the staff screen.'
                : 'Create your first table to start managing the floor.'
            }
            action={canManageTableConfig ? (
              <Button onClick={openCreateForm}>
                <Plus className="h-4 w-4" />
                Create First Table
              </Button>
            ) : null}
          />
        )
      ) : (
        <>
          {visibleTables.length === 0 ? (
            <EmptyState
              icon={TableProperties}
              title={tableView === 'assigned' ? 'No QR assignments yet' : 'No tables available'}
              description={
                tableView === 'assigned'
                  ? 'You do not have any QR assigned tables right now. They will appear here after a QR confirmation.'
                  : 'Tables are not available. Please refresh or contact your manager.'
              }
            />
          ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {paginatedTables.map((table) => {
              const meta = TABLE_STATUS_META[table.effectiveStatus] || TABLE_STATUS_META.open;
              const duplicateBillCount = Math.max(0, table.activeOrders.length - 1);

              return (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => setSelectedTable(table)}
                  className={`rounded-[1.4rem] border p-3 text-left shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-floating)] ${meta.card} ${
                    selectedTableData?.id === table.id ? 'ring-2 ring-[var(--color-primary)]' : 'border-[var(--border-color)]'
                  }`}
                >
                  <div className="flex flex-col gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)]">Table</p>
                      <h2 className="mt-1.5 text-2xl font-black text-[var(--text-primary)]">{table.tableNumber}</h2>
                      {table.mergedTableNumbers?.length > 1 ? (
                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-primary)]">
                          {table.mergedDisplayName}
                        </p>
                      ) : null}
                    </div>
                    <span className={`inline-flex w-fit max-w-full items-center gap-2 self-start whitespace-normal break-words rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${meta.badge}`}>
                      <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="rounded-2xl bg-[var(--color-panel)]/70 px-3 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">Seats</p>
                      <p className="mt-2 text-lg font-bold text-[var(--text-primary)]">{table.seatCapacity || '-'}</p>
                    </div>
                    {table.assignedWaiterName ? (
                      <div className="rounded-2xl bg-[var(--color-panel)]/70 px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">Assigned Waiter</p>
                        <p className="mt-2 text-sm font-bold text-[var(--text-primary)]">{table.assignedWaiterName}</p>
                      </div>
                    ) : null}
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
        </>
      )}

      <Modal
        title={selectedTableData?.mergedDisplayName || (selectedTableData ? `Table ${selectedTableData.tableNumber}` : 'Table Details')}
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
              type="text"
              value={formData.tableNumber}
              onChange={(event) => setFormData({ ...formData, tableNumber: event.target.value })}
              placeholder="e.g. 1, A1, C9"
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
  const statusMeta = TABLE_STATUS_META[table.effectiveStatus] || TABLE_STATUS_META.open;
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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">Open Bills</p>
          <p className="mt-3 text-2xl font-black text-[var(--text-primary)]">{activeOrders.length}</p>
        </div>
      </div>

      {table.mergedTableNumbers?.length > 1 ? (
        <div className="rounded-[1.6rem] border border-[var(--color-primary)]/20 bg-[var(--color-primary-soft)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">Merged Tables</p>
          <p className="mt-3 text-base font-bold text-[var(--text-primary)]">{table.mergedDisplayName}</p>
        </div>
      ) : null}

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

      {table.isClosed ? (
        <div className="rounded-[1.6rem] border border-slate-500/25 bg-slate-500/10 p-4">
          <p className="font-bold text-[var(--text-primary)]">Closed by manager</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {table.closureNote || 'This table is temporarily blocked for service.'}
          </p>
        </div>
      ) : null}

      {table.assignedWaiterId ? (
        <div className="rounded-[1.6rem] border border-[var(--border-color)] bg-[var(--color-panel)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
            {table.lockedByQr ? 'QR Waiter Lock' : 'Assigned Waiter'}
          </p>
          <p className="mt-3 text-base font-bold text-[var(--text-primary)]">{table.assignedWaiterName || 'Assigned from manager portal'}</p>
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
              <Button onClick={() => onOpenBilling(currentOrder)} disabled={table.isClosed}>
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
                          {formatDate(order.updatedAt || order.createdAt)} • {order.status} • {order.paymentStatus || 'pending'}
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
