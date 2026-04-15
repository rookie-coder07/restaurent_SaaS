import { Activity, Pencil, PlusCircle, ShieldCheck, Trash2, UserRound, Users } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApi } from '../hooks/useApi';
import useAutoRefresh from '../hooks/useAutoRefresh';
import { orderAPI, restaurantAPI, tableAPI } from '../services/apiEndpoints';
import { useManagerStore } from '../context/managerStore';
import { formatDisplayOrderNumber } from '../utils/formatters';
import { getTableActivity } from '../utils/managerPortal';
import { subscribeToOrderEvents } from '../utils/liveOrderEvents';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import Toast from '../components/common/Toast';
import PaginationControls from '../components/common/PaginationControls';
import useResponsivePagination from '../hooks/useResponsivePagination';

export default function ManagerWaiters() {
  const { data: staffData = {}, refetch: refetchStaff } = useApi(() => restaurantAPI.getStaff({ limit: 100, skip: 0, isActive: true }));
  const { data: tablesData = {}, refetch: refetchTables } = useApi(() => tableAPI.getTables({ limit: 200 }));
  const { data: ordersData = {}, refetch: refetchOrders } = useApi(orderAPI.getOpenBills);
  const overrideAccess = useManagerStore((state) => state.overrideAccess);
  const waiterActivity = useManagerStore((state) => state.waiterActivity);
  const tableClosures = useManagerStore((state) => state.tableClosures);
  const tableTransfers = useManagerStore((state) => state.tableTransfers);
  const tableMerges = useManagerStore((state) => state.tableMerges);
  const assignTable = useManagerStore((state) => state.assignTable);
  const unassignTable = useManagerStore((state) => state.unassignTable);
  const toggleOverrideAccess = useManagerStore((state) => state.toggleOverrideAccess);
  const logWaiterActivity = useManagerStore((state) => state.logWaiterActivity);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [editingAllocation, setEditingAllocation] = useState(null);
  const [nextWaiterId, setNextWaiterId] = useState('');
  const [assignmentDrafts, setAssignmentDrafts] = useState({});
  const refetchDebounceRef = useRef(null);
  
  const waiters = useMemo(() => (staffData?.staff || []).filter((member) => member.role === 'staff'), [staffData]);
  const tables = tablesData?.tables || [];
  const orders = Array.isArray(ordersData) ? ordersData : [];
  
  const persistedTableAssignments = useMemo(
    () => {
      const assignmentsFromStaff = waiters.reduce((accumulator, waiter) => {
        (waiter.assignedTables || []).forEach((tableId) => {
          if (tableId && !accumulator[tableId]) {
            accumulator[tableId] = waiter.id;
          }
        });

        return accumulator;
      }, {});

      const assignmentsFromTables = (tables || []).reduce((accumulator, table) => {
        if (table?.id && table?.assignedTo) {
          accumulator[table.id] = table.assignedTo;
        }

        return accumulator;
      }, {});

      return {
        ...assignmentsFromStaff,
        ...assignmentsFromTables,
      };
    },
    [tables, waiters]
  );
  const enrichedTables = useMemo(
    () =>
      tables.map((table) =>
        getTableActivity(table, orders, persistedTableAssignments, tableClosures, tableTransfers, tableMerges, tables)
      ),
    [orders, persistedTableAssignments, tableClosures, tableMerges, tableTransfers, tables]
  );
  const visibleTables = useMemo(
    () => enrichedTables.filter((table) => !table.isMergedSecondary),
    [enrichedTables]
  );
  const {
    paginatedItems: paginatedWaiters,
    currentPage,
    totalPages,
    canGoPrevious,
    canGoNext,
    goPrevious,
    goNext,
    hasPagination,
  } = useResponsivePagination(waiters, { mobileItemsPerPage: 4, desktopItemsPerPage: 6 });

  useAutoRefresh(() => Promise.allSettled([refetchStaff(), refetchTables(), refetchOrders()]), 12000);

  const debouncedRefetch = () => {
    if (refetchDebounceRef.current) {
      window.clearTimeout(refetchDebounceRef.current);
    }
    refetchDebounceRef.current = window.setTimeout(() => {
      Promise.allSettled([refetchTables(), refetchOrders()]);
    }, 300);
  };

  useEffect(() => {
    const cleanup = subscribeToOrderEvents((payload) => {
      if (String(payload?.type || '') === 'order.deleted' && payload?.tableId) {
        unassignTable(payload.tableId);
      }
      debouncedRefetch();
    });

    return cleanup;
  }, [unassignTable]);

  const persistTableAssignment = async (tableId, waiterId) => {
    const targetWaiter = waiters.find((waiter) => waiter.id === waiterId);
    if (!targetWaiter) {
      throw new Error('Selected waiter was not found.');
    }

    const currentlyAssignedWaiter = waiters.find((waiter) => (waiter.assignedTables || []).includes(tableId));
    const nextTargetAssignments = Array.from(
      new Set([...(targetWaiter.assignedTables || []).filter(Boolean), tableId])
    );

    if (currentlyAssignedWaiter && currentlyAssignedWaiter.id !== waiterId) {
      throw new Error(`Remove Table ${tables.find((table) => table.id === tableId)?.tableNumber || ''} from ${currentlyAssignedWaiter.name} first.`);
    }

    await restaurantAPI.updateStaff(waiterId, {
      assignedTables: nextTargetAssignments,
    });
    assignTable(tableId, waiterId);
    logWaiterActivity({ waiterId, action: 'assigned_table', tableId });
    await Promise.allSettled([refetchStaff(), refetchTables(), refetchOrders()]);
  };

  const clearTableAssignment = async (tableId, waiterId) => {
    const currentWaiter = waiters.find((waiter) => waiter.id === waiterId);
    if (!currentWaiter) {
      return;
    }

    await restaurantAPI.updateStaff(waiterId, {
      assignedTables: (currentWaiter.assignedTables || []).filter((assignedTableId) => assignedTableId !== tableId),
    });
    unassignTable(tableId);
    logWaiterActivity({ waiterId, action: 'unassigned_table', tableId });
    await Promise.allSettled([refetchStaff(), refetchTables(), refetchOrders()]);
  };

  const handleAssignment = async (tableId, waiterId) => {
    setError('');

    try {
      await persistTableAssignment(tableId, waiterId);
      setSuccess('Table assignment updated.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Failed to assign the table.');
    }
  };

  const assignSelectedTable = async (waiterId) => {
    const tableId = assignmentDrafts[waiterId];
    if (!tableId) {
      return;
    }

    await handleAssignment(tableId, waiterId);
    setAssignmentDrafts((current) => ({
      ...current,
      [waiterId]: '',
    }));
  };

  const openAllocationEditor = (table, waiterId) => {
    setEditingAllocation({
      tableId: table.id,
      tableNumber: table.tableNumber,
      currentWaiterId: waiterId,
    });
    setNextWaiterId(waiterId);
  };

  const saveAllocationChange = async () => {
    if (!editingAllocation?.tableId || !nextWaiterId || nextWaiterId === editingAllocation.currentWaiterId) {
      setEditingAllocation(null);
      return;
    }

    setError('Remove this table from the current waiter first, then assign it to another waiter.');
  };

  const removeAllocation = async (tableId, waiterId, tableNumber) => {
    setError('');

    try {
      await clearTableAssignment(tableId, waiterId);
      setSuccess(`Table ${tableNumber} allocation removed.`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Failed to remove the table allocation.');
    }
  };

  return (
    <div className="space-y-6">
      {success ? <Toast type="success" message={success} /> : null}
      {error ? <Toast type="error" message={error} /> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {paginatedWaiters.map((waiter) => {
          const assignedTables = visibleTables.filter((table) => persistedTableAssignments[table.id] === waiter.id);
          const waiterOrders = assignedTables.flatMap((table) => table.activeOrders || []);
          const latestActivity = waiterActivity[waiter.id];
          const availableTables = visibleTables.filter(
            (table) =>
              table.effectiveStatus !== 'closed' &&
              !table.isMergedPrimary &&
              !persistedTableAssignments[table.id]
          );

          return (
            <Card key={waiter.id} className="p-4">
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                      <UserRound className="h-5 w-5" />
                    </div>
                    <h2 className="mt-3 truncate text-lg font-bold text-[var(--color-text)]">{waiter.name}</h2>
                    <p className="mt-1 truncate text-sm text-[var(--color-text-muted)]">{waiter.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      toggleOverrideAccess(waiter.id);
                      logWaiterActivity({ waiterId: waiter.id, action: overrideAccess[waiter.id] ? 'override_disabled' : 'override_enabled' });
                      setSuccess('Waiter override access updated.');
                    }}
                    className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold ${overrideAccess[waiter.id] ? 'bg-emerald-500/15 text-emerald-400' : 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'}`}
                  >
                    <ShieldCheck className="mr-1 inline h-4 w-4" />
                    {overrideAccess[waiter.id] ? 'Override On' : 'Override Off'}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-[var(--color-surface-muted)] px-3 py-3 text-center">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">Tables</p>
                    <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">{assignedTables.length}</p>
                  </div>
                  <div className="rounded-2xl bg-[var(--color-surface-muted)] px-3 py-3 text-center">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">Orders</p>
                    <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">{waiterOrders.length}</p>
                  </div>
                  <div className="rounded-2xl bg-[var(--color-surface-muted)] px-3 py-3 text-center">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">Access</p>
                    <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">{overrideAccess[waiter.id] ? 'Override' : 'Standard'}</p>
                  </div>
                </div>

                <div className="rounded-2xl bg-[var(--color-surface-muted)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--color-text)]">Assigned tables</p>
                    <span className="text-xs text-[var(--text-secondary)]">{assignedTables.length === 0 ? 'None' : `${assignedTables.length} active`}</span>
                  </div>
                  {assignedTables.length === 0 ? (
                    <p className="mt-2 text-sm text-[var(--color-text-muted)]">No tables assigned yet.</p>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {assignedTables.map((table) => (
                        <div
                          key={`${waiter.id}-${table.id}`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-color)] bg-[var(--color-panel)] px-3 py-1.5"
                        >
                          <span className="text-sm font-semibold text-[var(--text-primary)]">
                            {table.mergedTableNumbers?.length > 1 ? table.mergedDisplayName.replace('Table ', 'T') : `T${table.tableNumber}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => openAllocationEditor(table, waiter.id)}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-surface-muted)] text-[var(--text-secondary)] transition hover:text-[var(--color-primary)]"
                            aria-label={`Edit allocation for table ${table.tableNumber}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeAllocation(table.id, waiter.id, table.tableNumber)}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-surface-muted)] text-[var(--text-secondary)] transition hover:text-red-400"
                            aria-label={`Remove allocation for table ${table.tableNumber}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl bg-[var(--color-surface-muted)] p-4">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-[var(--color-primary)]" />
                    <p className="text-sm font-semibold text-[var(--color-text)]">Latest activity</p>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-[var(--color-text-muted)]">
                    {latestActivity
                      ? `${latestActivity.action.replaceAll('_', ' ')}${latestActivity.tableId ? ` on table ${tables.find((table) => table.id === latestActivity.tableId)?.tableNumber || ''}` : ''}`
                      : 'No manager-tracked activity yet.'}
                  </p>
                  {latestActivity?.orderId ? (
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                      {formatDisplayOrderNumber(orders.find((order) => order.id === latestActivity.orderId) || { id: latestActivity.orderId })}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--color-panel)] p-4">
                  <p className="text-sm font-semibold text-[var(--color-text)]">Quick assign</p>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                    <select
                      value={assignmentDrafts[waiter.id] || ''}
                      onChange={(event) =>
                        setAssignmentDrafts((current) => ({
                          ...current,
                          [waiter.id]: event.target.value,
                        }))
                      }
                      className="input min-w-0 flex-1"
                    >
                      <option value="">Select a table</option>
                      {availableTables.map((table) => (
                        <option key={table.id} value={table.id}>
                          {table.mergedDisplayName || `Table ${table.tableNumber}`}
                        </option>
                      ))}
                    </select>
                    <Button
                      className="sm:shrink-0"
                      onClick={() => assignSelectedTable(waiter.id)}
                      disabled={!assignmentDrafts[waiter.id]}
                    >
                      <PlusCircle className="h-4 w-4" />
                      Assign
                    </Button>
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

      {waiters.length === 0 ? (
        <Card className="p-8 text-center">
          <Users className="mx-auto h-10 w-10 text-[var(--color-primary)]" />
          <p className="mt-4 text-sm text-[var(--color-text-muted)]">No waiter accounts were found for this restaurant.</p>
        </Card>
      ) : null}

      <Modal
        title={editingAllocation ? `Edit table ${editingAllocation.tableNumber} allocation` : 'Edit allocation'}
        isOpen={Boolean(editingAllocation)}
        onClose={() => {
          setEditingAllocation(null);
          setNextWaiterId('');
        }}
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <div className="rounded-2xl bg-[var(--color-surface-muted)] p-4">
            <p className="text-sm text-[var(--text-secondary)]">Current assignment</p>
            <p className="mt-2 text-lg font-bold text-[var(--text-primary)]">
              {waiters.find((waiter) => waiter.id === editingAllocation?.currentWaiterId)?.name || 'Unassigned'}
            </p>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">Reassign to waiter</span>
            <select
              value={nextWaiterId}
              onChange={(event) => setNextWaiterId(event.target.value)}
              className="input"
            >
              {waiters.map((waiter) => (
                <option key={waiter.id} value={waiter.id}>
                  {waiter.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button
              variant="secondary"
              className="w-full sm:flex-1"
              onClick={() => {
                setEditingAllocation(null);
                setNextWaiterId('');
              }}
            >
              Cancel
            </Button>
            <Button className="w-full sm:flex-1" onClick={saveAllocationChange}>
              Save Allocation
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
