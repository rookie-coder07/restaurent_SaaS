import { GitMerge, LockKeyhole, Loader, SplitSquareVertical, UserPlus2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useApi } from '../hooks/useApi';
import useAutoRefresh from '../hooks/useAutoRefresh';
import { orderAPI, restaurantAPI, tableAPI } from '../services/apiEndpoints';
import { useManagerStore } from '../context/managerStore';
import { getTableActivity } from '../utils/managerPortal';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import Toast from '../components/common/Toast';

export default function ManagerTables() {
  const { data: tablesData = {}, loading, refetch: refetchTables } = useApi(() => tableAPI.getTables({ limit: 200 }));
  const { data: ordersData = {}, refetch: refetchOrders } = useApi(orderAPI.getOpenBills);
  const { data: staffData = {}, refetch: refetchStaff } = useApi(() => restaurantAPI.getStaff({ limit: 100, skip: 0, isActive: true }));
  const tableAssignments = useManagerStore((state) => state.tableAssignments);
  const tableClosures = useManagerStore((state) => state.tableClosures);
  const tableTransfers = useManagerStore((state) => state.tableTransfers);
  const tableMerges = useManagerStore((state) => state.tableMerges);
  const assignTable = useManagerStore((state) => state.assignTable);
  const unassignTable = useManagerStore((state) => state.unassignTable);
  const setTableClosed = useManagerStore((state) => state.setTableClosed);
  const mergeTables = useManagerStore((state) => state.mergeTables);
  const unmergeTables = useManagerStore((state) => state.unmergeTables);
  const logWaiterActivity = useManagerStore((state) => state.logWaiterActivity);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState('');
  const [mergeSelection, setMergeSelection] = useState([]);
  const [showMergePicker, setShowMergePicker] = useState(false);
  const [mergePrimaryTableId, setMergePrimaryTableId] = useState('');

  const tables = tablesData?.tables || [];
  const openBills = Array.isArray(ordersData) ? ordersData : [];
  const waiters = (staffData?.staff || []).filter((member) => member.role === 'staff');
  const enrichedTables = useMemo(
    () =>
      tables.map((table) =>
        getTableActivity(table, openBills, tableAssignments, tableClosures, tableTransfers, tableMerges, tables)
      ),
    [openBills, tableAssignments, tableClosures, tableMerges, tableTransfers, tables]
  );
  const visibleTables = useMemo(
    () => enrichedTables.filter((table) => !table.isMergedSecondary),
    [enrichedTables]
  );
  const selectedTable = useMemo(
    () => visibleTables.find((table) => table.id === selectedTableId) || null,
    [selectedTableId, visibleTables]
  );
  const mergeTargetTable = useMemo(
    () => visibleTables.find((table) => table.id === (selectedTable?.id || mergePrimaryTableId)) || null,
    [mergePrimaryTableId, selectedTable, visibleTables]
  );
  const freeTables = visibleTables.filter((table) => table.effectiveStatus === 'open').length;
  const occupiedTables = visibleTables.filter((table) => table.effectiveStatus === 'busy').length;
  const assignedWaiter = selectedTable ? waiters.find((waiter) => waiter.id === tableAssignments[selectedTable.id]) : null;
  const mergeOptions = useMemo(
    () =>
      visibleTables.filter(
        (table) =>
          table.id !== (selectedTable?.id || mergePrimaryTableId) &&
          table.effectiveStatus === 'open' &&
          !table.isMergedPrimary &&
          (table.activeOrders || []).length === 0
      ),
    [mergePrimaryTableId, selectedTable, visibleTables]
  );
  const mergePrimaryOptions = useMemo(
    () =>
      visibleTables.filter(
        (table) => table.effectiveStatus === 'open' && (table.activeOrders || []).length === 0
      ),
    [visibleTables]
  );

  useEffect(() => {
    setMergeSelection([]);
  }, [selectedTableId]);

  useAutoRefresh(() => Promise.allSettled([refetchTables(), refetchOrders(), refetchStaff()]), 12000);

  const closeMergePicker = () => {
    setShowMergePicker(false);
    setMergeSelection([]);
    setMergePrimaryTableId('');
  };

  const refreshFloor = async () => {
    await Promise.all([refetchTables(), refetchOrders()]);
  };

  const handleAssign = (tableId, waiterId) => {
    assignTable(tableId, waiterId);
    logWaiterActivity({ waiterId, action: 'assigned_table', tableId });
    setSuccess('Waiter assigned to table.');
    setError('');
  };

  const handleUnassign = () => {
    if (!selectedTable) {
      return;
    }

    unassignTable(selectedTable.id);
    setSuccess('Waiter unassigned from table.');
    setError('');
  };

  const handleMerge = async () => {
    if (!mergeTargetTable || mergeSelection.length === 0) {
      return;
    }

    if ((mergeTargetTable.activeOrders || []).length > 0) {
      setError('A table with a running order cannot be merged.');
      return;
    }

    const secondaryTables = visibleTables.filter((table) => mergeSelection.includes(table.id));
    const hasBlockedSecondary = secondaryTables.some((table) => (table.activeOrders || []).length > 0);

    if (hasBlockedSecondary) {
      setError('Only tables without running orders can be merged.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      mergeTables({
        primaryTableId: mergeTargetTable.id,
        secondaryTableIds: mergeSelection,
        note: 'Manager merge',
      });
      await refreshFloor();
      setSuccess('Tables merged successfully.');
      if (selectedTable) {
        setSelectedTableId(mergeTargetTable.id);
      }
      closeMergePicker();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to merge the selected tables.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemerge = async () => {
    if (!selectedTable || (selectedTable.mergedTableIds || []).length <= 1) {
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      unmergeTables({ tableIds: selectedTable.mergedTableIds || [] });
      await refreshFloor();
      setSuccess('Merged tables separated successfully.');
      setSelectedTableId(selectedTable.id);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to separate the merged tables.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && enrichedTables.length === 0) {
    return <div className="flex h-full items-center justify-center"><Loader className="h-8 w-8 animate-spin text-[var(--color-primary)]" /></div>;
  }

  return (
    <div className="space-y-6">
      {success ? <Toast type="success" message={success} /> : null}
      {error ? <Toast type="error" message={error} /> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5"><p className="text-sm text-[var(--text-secondary)]">Free tables</p><p className="mt-2 text-3xl font-bold text-emerald-400">{freeTables}</p></Card>
        <Card className="p-5"><p className="text-sm text-[var(--text-secondary)]">Occupied tables</p><p className="mt-2 text-3xl font-bold text-amber-400">{occupiedTables}</p></Card>
        <Card className="p-5"><p className="text-sm text-[var(--text-secondary)]">Closed tables</p><p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{visibleTables.filter((table) => table.effectiveStatus === 'closed').length}</p></Card>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Tables</h2>
          <p className="text-sm text-[var(--text-secondary)]">Open a table to manage it or start a merged group from here.</p>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            setSelectedTableId('');
            setMergePrimaryTableId('');
            setMergeSelection([]);
            setShowMergePicker(true);
            setError('');
          }}
        >
          <GitMerge className="h-4 w-4" />
          Merge Tables
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {visibleTables.map((table) => (
          <button
            key={table.id}
            type="button"
            onClick={() => setSelectedTableId(table.id)}
            className={`rounded-[1.75rem] border p-4 text-left ${
              table.effectiveStatus === 'busy'
                ? 'border-amber-500/20 bg-amber-500/10'
                : table.effectiveStatus === 'closed'
                  ? 'border-slate-500/20 bg-slate-500/10'
                  : 'border-emerald-500/20 bg-emerald-500/10'
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-subtle)]">Table</p>
            <h2 className="mt-2 text-3xl font-black text-[var(--color-text)]">{table.tableNumber}</h2>
            {table.mergedTableNumbers?.length > 1 ? (
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-primary)]">
                {table.mergedDisplayName}
              </p>
            ) : null}
            <p className="mt-2 text-sm capitalize text-[var(--color-text-muted)]">{table.effectiveStatus}</p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{table.activeOrders.length} active orders</p>
          </button>
        ))}
      </div>

      <Modal
        title={selectedTable?.mergedDisplayName || (selectedTable ? `Manage table ${selectedTable.tableNumber}` : 'Manage table')}
        isOpen={Boolean(selectedTable)}
        onClose={() => setSelectedTableId('')}
        maxWidth="max-w-4xl"
      >
        {selectedTable ? (
          <div className="space-y-5">
            {selectedTable.mergedTableNumbers?.length > 1 ? (
              <Card className="p-4">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Merged group</p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">{selectedTable.mergedDisplayName}</p>
              </Card>
            ) : null}

            <Card className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Waiter assignment</p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {assignedWaiter
                      ? `${assignedWaiter.name} is assigned to this table.`
                      : 'No waiter assigned to this table.'}
                  </p>
                </div>
                {assignedWaiter ? (
                  <Button variant="secondary" onClick={handleUnassign}>
                    Clear assignment
                  </Button>
                ) : null}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {waiters.map((waiter) => (
                  <Button
                    key={waiter.id}
                    variant={tableAssignments[selectedTable.id] === waiter.id ? 'secondary' : 'primary'}
                    onClick={() => handleAssign(selectedTable.id, waiter.id)}
                  >
                    <UserPlus2 className="h-4 w-4" />
                    Assign {waiter.name}
                  </Button>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Open / close table</p>
              <div className="mt-4 flex gap-3">
                <Button
                  variant="secondary"
                  onClick={async () => {
                    setSubmitting(true);
                    setError('');
                    try {
                      await tableAPI.updateTable(selectedTable.id, { status: 'available', reservedBy: null, reservationTime: null });
                      setTableClosed(selectedTable.id, false);
                      await refreshFloor();
                      setSuccess('Table reopened.');
                    } catch (requestError) {
                      setError(requestError.response?.data?.message || 'Failed to reopen the table.');
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  disabled={submitting}
                >
                  Open Table
                </Button>
                <Button
                  onClick={async () => {
                    if ((selectedTable.activeOrders || []).length > 0) {
                      setError('Settle, cancel, or merge the active bill before closing this table.');
                      return;
                    }

                    setSubmitting(true);
                    setError('');
                    try {
                      await tableAPI.updateTable(selectedTable.id, { status: 'closed', reservedBy: null, reservationTime: null });
                      setTableClosed(selectedTable.id, true, 'Manager close');
                      await refreshFloor();
                      setSuccess('Table closed.');
                    } catch (requestError) {
                      setError(requestError.response?.data?.message || 'Failed to close the table.');
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  disabled={submitting}
                >
                  <LockKeyhole className="h-4 w-4" />
                  Close Table
                </Button>
              </div>
            </Card>

            <Card className="p-4">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Merge tables</p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                {selectedTable.mergedTableNumbers?.length > 1
                  ? 'This is a merged group. You can separate it back into individual tables.'
                  : (selectedTable.activeOrders || []).length > 0
                    ? 'This table has a running order, so it cannot be merged right now.'
                    : 'Open the merge picker and choose idle tables to join with this table.'}
              </p>
              {selectedTable.mergedTableNumbers?.length > 1 ? (
                <Button className="mt-4 w-full" variant="secondary" onClick={handleDemerge} disabled={submitting}>
                  <SplitSquareVertical className="h-4 w-4" />
                  Demerge Tables
                </Button>
              ) : (
                <Button
                  className="mt-4 w-full"
                  variant="secondary"
                  onClick={() => {
                    setMergePrimaryTableId('');
                    setShowMergePicker(true);
                    setError('');
                  }}
                  disabled={(selectedTable.activeOrders || []).length > 0 || submitting}
                >
                  <GitMerge className="h-4 w-4" />
                  Open Merge Picker
                </Button>
              )}
            </Card>
          </div>
        ) : null}
      </Modal>

      <Modal
        title={mergeTargetTable ? `Merge into ${mergeTargetTable.mergedDisplayName || `Table ${mergeTargetTable.tableNumber}`}` : 'Merge tables'}
        isOpen={showMergePicker}
        onClose={closeMergePicker}
        maxWidth="max-w-3xl"
      >
        <div className="space-y-5">
          {!selectedTable ? (
            <div className="space-y-3">
              <label className="text-sm font-semibold text-[var(--text-primary)]" htmlFor="merge-primary-table">
                Primary table
              </label>
              <select
                id="merge-primary-table"
                value={mergePrimaryTableId}
                onChange={(event) => {
                  setMergePrimaryTableId(event.target.value);
                  setMergeSelection([]);
                }}
                className="input"
              >
                <option value="">Select primary table</option>
                {mergePrimaryOptions.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.mergedDisplayName || `Table ${table.tableNumber}`}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {mergeTargetTable ? (
          <div className="space-y-5">
            <p className="text-sm text-[var(--text-secondary)]">
              Choose the idle tables you want to merge with {mergeTargetTable.mergedDisplayName || `Table ${mergeTargetTable.tableNumber}`}.
            </p>

            {mergeOptions.length === 0 ? (
              <Card className="p-4">
                <p className="text-sm font-semibold text-[var(--text-primary)]">No mergeable tables available</p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  Only open tables without running orders can be merged.
                </p>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {mergeOptions.map((table) => {
                  const active = mergeSelection.includes(table.id);

                  return (
                    <button
                      key={table.id}
                      type="button"
                      onClick={() =>
                        setMergeSelection((current) =>
                          active ? current.filter((value) => value !== table.id) : [...current, table.id]
                        )
                      }
                      className={`rounded-2xl border px-4 py-4 text-left text-sm font-semibold ${
                        active
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                          : 'border-[var(--border-color)] bg-[var(--color-surface-muted)] text-[var(--text-primary)]'
                      }`}
                    >
                      <p className="text-base font-bold">{table.mergedDisplayName || `Table ${table.tableNumber}`}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                        {table.effectiveStatus}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Button variant="secondary" className="w-full sm:flex-1" onClick={closeMergePicker}>
                Cancel
              </Button>
              <Button className="w-full sm:flex-1" onClick={handleMerge} disabled={mergeSelection.length === 0 || submitting}>
                <GitMerge className="h-4 w-4" />
                Merge Selected Tables
              </Button>
            </div>
          </div>
          ) : (
            <Card className="p-4">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Choose a primary table to continue</p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Only open tables without running orders can start a merged group.
              </p>
            </Card>
          )}
        </div>
      </Modal>
    </div>
  );
}
