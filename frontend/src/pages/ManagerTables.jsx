import { ArrowRightLeft, GitMerge, LockKeyhole, Loader, UserPlus2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { orderAPI, restaurantAPI, tableAPI } from '../services/apiEndpoints';
import { useManagerStore } from '../context/managerStore';
import { formatCurrency, formatDisplayOrderNumber } from '../utils/formatters';
import { getTableActivity } from '../utils/managerPortal';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import Toast from '../components/common/Toast';

export default function ManagerTables() {
  const { data: tablesData = {}, loading } = useApi(() => tableAPI.getTables({ limit: 200 }));
  const { data: ordersData = {} } = useApi(orderAPI.getOpenBills);
  const { data: staffData = {} } = useApi(() => restaurantAPI.getStaff({ limit: 100, skip: 0, isActive: true }));
  const tableAssignments = useManagerStore((state) => state.tableAssignments);
  const tableClosures = useManagerStore((state) => state.tableClosures);
  const assignTable = useManagerStore((state) => state.assignTable);
  const setTableClosed = useManagerStore((state) => state.setTableClosed);
  const transferTable = useManagerStore((state) => state.transferTable);
  const mergeTables = useManagerStore((state) => state.mergeTables);
  const logWaiterActivity = useManagerStore((state) => state.logWaiterActivity);
  const [success, setSuccess] = useState('');
  const [selectedTable, setSelectedTable] = useState(null);
  const [transferTarget, setTransferTarget] = useState('');
  const [mergeSelection, setMergeSelection] = useState([]);

  const tables = tablesData?.tables || [];
  const openBills = Array.isArray(ordersData) ? ordersData : [];
  const waiters = (staffData?.staff || []).filter((member) => member.role === 'staff');
  const enrichedTables = useMemo(
    () => tables.map((table) => getTableActivity(table, openBills, tableAssignments, tableClosures)),
    [openBills, tableAssignments, tableClosures, tables]
  );
  const freeTables = enrichedTables.filter((table) => table.effectiveStatus === 'open').length;
  const occupiedTables = enrichedTables.filter((table) => table.effectiveStatus === 'busy').length;

  const handleAssign = (tableId, waiterId) => {
    assignTable(tableId, waiterId);
    logWaiterActivity({ waiterId, action: 'assigned_table', tableId });
    setSuccess('Waiter assigned to table.');
  };

  const handleTransfer = () => {
    if (!selectedTable || !transferTarget) {
      return;
    }

    const destinationTable = enrichedTables.find((table) => table.id === transferTarget);

    transferTable({
      fromTableId: selectedTable.id,
      toTableId: transferTarget,
      fromTableNumber: selectedTable.tableNumber,
      toTableNumber: destinationTable?.tableNumber || '',
      waiterId: tableAssignments[selectedTable.id] || '',
      note: 'Manager table transfer',
    });
    setSuccess('Table transferred.');
    setSelectedTable(null);
    setTransferTarget('');
  };

  const handleMerge = () => {
    if (!selectedTable || mergeSelection.length === 0) {
      return;
    }

    mergeTables({
      primaryTableId: selectedTable.id,
      secondaryTableIds: mergeSelection,
      note: 'Manager merge',
    });
    setSuccess('Tables merged in manager workspace.');
    setSelectedTable(null);
    setMergeSelection([]);
  };

  if (loading && enrichedTables.length === 0) {
    return <div className="flex h-full items-center justify-center"><Loader className="h-8 w-8 animate-spin text-[var(--color-primary)]" /></div>;
  }

  return (
    <div className="space-y-6">
      {success ? <Toast type="success" message={success} /> : null}

      <Card>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--color-text-subtle)]">Table Operations</p>
        <h1 className="mt-3 text-3xl font-bold text-[var(--color-text)]">Open, close, assign, transfer, and merge tables</h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">Managers can control live floor flow while owner-only table setup stays protected.</p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5"><p className="text-sm text-[var(--text-secondary)]">Free tables</p><p className="mt-2 text-3xl font-bold text-emerald-400">{freeTables}</p></Card>
        <Card className="p-5"><p className="text-sm text-[var(--text-secondary)]">Occupied tables</p><p className="mt-2 text-3xl font-bold text-amber-400">{occupiedTables}</p></Card>
        <Card className="p-5"><p className="text-sm text-[var(--text-secondary)]">Closed tables</p><p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{Object.keys(tableClosures).length}</p></Card>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {enrichedTables.map((table) => (
          <button
            key={table.id}
            type="button"
            onClick={() => setSelectedTable(table)}
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
            <p className="mt-2 text-sm capitalize text-[var(--color-text-muted)]">{table.effectiveStatus}</p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{table.activeOrders.length} active orders</p>
          </button>
        ))}
      </div>

      <Modal title={selectedTable ? `Manage table ${selectedTable.tableNumber}` : 'Manage table'} isOpen={Boolean(selectedTable)} onClose={() => setSelectedTable(null)} maxWidth="max-w-4xl">
        {selectedTable ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-4">
              <Card className="p-4"><p className="text-sm text-[var(--text-secondary)]">Status</p><p className="mt-2 text-xl font-bold capitalize text-[var(--text-primary)]">{selectedTable.effectiveStatus}</p></Card>
              <Card className="p-4"><p className="text-sm text-[var(--text-secondary)]">Waiter</p><p className="mt-2 text-xl font-bold text-[var(--text-primary)]">{waiters.find((waiter) => waiter.id === tableAssignments[selectedTable.id])?.name || 'Unassigned'}</p></Card>
              <Card className="p-4"><p className="text-sm text-[var(--text-secondary)]">Running order</p><p className="mt-2 text-base font-bold text-[var(--text-primary)]">{selectedTable.activeOrders[0] ? formatDisplayOrderNumber(selectedTable.activeOrders[0]) : 'None'}</p></Card>
              <Card className="p-4"><p className="text-sm text-[var(--text-secondary)]">Live bill</p><p className="mt-2 text-base font-bold text-[var(--text-primary)]">{selectedTable.activeOrders[0] ? formatCurrency(selectedTable.activeOrders[0].totalAmount || 0) : 'No bill'}</p></Card>
            </div>

            <Card className="p-4">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Quick waiter assignment</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {waiters.map((waiter) => (
                  <Button key={waiter.id} variant={tableAssignments[selectedTable.id] === waiter.id ? 'secondary' : 'primary'} onClick={() => handleAssign(selectedTable.id, waiter.id)}>
                    <UserPlus2 className="h-4 w-4" />
                    Assign {waiter.name}
                  </Button>
                ))}
              </div>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-4">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Open / close table</p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">Use close mode for cleaning, maintenance, or temporary hold.</p>
                <div className="mt-4 flex gap-3">
                  <Button variant="secondary" onClick={() => { setTableClosed(selectedTable.id, false); setSuccess('Table reopened.'); }}>
                    Open Table
                  </Button>
                  <Button onClick={() => { setTableClosed(selectedTable.id, true, 'Manager close'); setSuccess('Table closed.'); }}>
                    <LockKeyhole className="h-4 w-4" />
                    Close Table
                  </Button>
                </div>
              </Card>

              <Card className="p-4">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Transfer table</p>
                <select value={transferTarget} onChange={(event) => setTransferTarget(event.target.value)} className="input mt-4">
                  <option value="">Select destination table</option>
                  {enrichedTables.filter((table) => table.id !== selectedTable.id).map((table) => (
                    <option key={table.id} value={table.id}>Table {table.tableNumber}</option>
                  ))}
                </select>
                <Button className="mt-3 w-full" onClick={handleTransfer}>
                  <ArrowRightLeft className="h-4 w-4" />
                  Transfer Table
                </Button>
              </Card>
            </div>

            <Card className="p-4">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Merge tables</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {enrichedTables.filter((table) => table.id !== selectedTable.id).map((table) => {
                  const active = mergeSelection.includes(table.id);

                  return (
                    <button
                      key={table.id}
                      type="button"
                      onClick={() => setMergeSelection((current) => active ? current.filter((value) => value !== table.id) : [...current, table.id])}
                      className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${active ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]' : 'border-[var(--border-color)] bg-[var(--color-surface-muted)] text-[var(--text-primary)]'}`}
                    >
                      Table {table.tableNumber}
                    </button>
                  );
                })}
              </div>
              <Button className="mt-4 w-full" onClick={handleMerge}>
                <GitMerge className="h-4 w-4" />
                Merge into Table {selectedTable.tableNumber}
              </Button>
            </Card>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
