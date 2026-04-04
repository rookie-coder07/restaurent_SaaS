import { Activity, ShieldCheck, UserRound, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { orderAPI, restaurantAPI, tableAPI } from '../services/apiEndpoints';
import { useManagerStore } from '../context/managerStore';
import { formatDisplayOrderNumber } from '../utils/formatters';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Toast from '../components/common/Toast';
import PaginationControls from '../components/common/PaginationControls';
import useResponsivePagination from '../hooks/useResponsivePagination';

export default function ManagerWaiters() {
  const { data: staffData = {} } = useApi(() => restaurantAPI.getStaff({ limit: 100, skip: 0, isActive: true }));
  const { data: tablesData = {} } = useApi(() => tableAPI.getTables({ limit: 200 }));
  const { data: ordersData = {} } = useApi(() => orderAPI.getOrders({ limit: 150 }));
  const tableAssignments = useManagerStore((state) => state.tableAssignments);
  const overrideAccess = useManagerStore((state) => state.overrideAccess);
  const waiterActivity = useManagerStore((state) => state.waiterActivity);
  const assignTable = useManagerStore((state) => state.assignTable);
  const toggleOverrideAccess = useManagerStore((state) => state.toggleOverrideAccess);
  const logWaiterActivity = useManagerStore((state) => state.logWaiterActivity);
  const [success, setSuccess] = useState('');

  const waiters = useMemo(() => (staffData?.staff || []).filter((member) => member.role === 'staff'), [staffData]);
  const tables = tablesData?.tables || [];
  const orders = ordersData?.items || [];
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

  const handleAssignment = (tableId, waiterId) => {
    assignTable(tableId, waiterId);
    logWaiterActivity({ waiterId, action: 'assigned_table', tableId });
    setSuccess('Table assignment updated.');
  };

  return (
    <div className="space-y-6">
      {success ? <Toast type="success" message={success} /> : null}

      <Card>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--color-text-subtle)]">Waiter Control</p>
        <h1 className="mt-3 text-3xl font-bold text-[var(--color-text)]">Assign tables, override access, and monitor floor activity</h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">Managers can rebalance waiter coverage and step in on any table when service pressure rises.</p>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {paginatedWaiters.map((waiter) => {
          const assignedTables = tables.filter((table) => tableAssignments[table.id] === waiter.id);
          const waiterOrders = orders.filter((order) => assignedTables.some((table) => table.id === order.tableId));
          const latestActivity = waiterActivity[waiter.id];

          return (
            <Card key={waiter.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <h2 className="mt-3 text-xl font-bold text-[var(--color-text)]">{waiter.name}</h2>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">{waiter.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    toggleOverrideAccess(waiter.id);
                    logWaiterActivity({ waiterId: waiter.id, action: overrideAccess[waiter.id] ? 'override_disabled' : 'override_enabled' });
                    setSuccess('Waiter override access updated.');
                  }}
                  className={`rounded-full px-3 py-2 text-xs font-semibold ${overrideAccess[waiter.id] ? 'bg-emerald-500/15 text-emerald-400' : 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'}`}
                >
                  <ShieldCheck className="mr-1 inline h-4 w-4" />
                  {overrideAccess[waiter.id] ? 'Override On' : 'Override Off'}
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-[var(--color-surface-muted)] p-4">
                  <p className="text-sm text-[var(--text-secondary)]">Assigned tables</p>
                  <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{assignedTables.length}</p>
                </div>
                <div className="rounded-2xl bg-[var(--color-surface-muted)] p-4">
                  <p className="text-sm text-[var(--text-secondary)]">Live orders</p>
                  <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{waiterOrders.length}</p>
                </div>
                <div className="rounded-2xl bg-[var(--color-surface-muted)] p-4">
                  <p className="text-sm text-[var(--text-secondary)]">Access</p>
                  <p className="mt-2 text-base font-bold text-[var(--text-primary)]">{overrideAccess[waiter.id] ? 'Override' : 'Standard'}</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-[var(--color-surface-muted)] p-4">
                <p className="text-sm font-semibold text-[var(--color-text)]">Assigned tables</p>
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                  {assignedTables.length > 0 ? assignedTables.map((table) => `T${table.tableNumber}`).join(', ') : 'No tables assigned yet.'}
                </p>
              </div>

              <div className="mt-4 rounded-2xl bg-[var(--color-surface-muted)] p-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[var(--color-primary)]" />
                  <p className="text-sm font-semibold text-[var(--color-text)]">Latest activity</p>
                </div>
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">
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

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {tables.slice(0, 12).map((table) => (
                  <Button
                    key={table.id}
                    variant={tableAssignments[table.id] === waiter.id ? 'secondary' : 'primary'}
                    onClick={() => handleAssignment(table.id, waiter.id)}
                  >
                    Table {table.tableNumber}
                  </Button>
                ))}
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
    </div>
  );
}
