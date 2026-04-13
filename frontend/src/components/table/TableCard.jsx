/**
 * Optimized Table Card Component with Memoization
 * Prevents unnecessary re-renders when parent updates
 */

import React, { memo } from 'react';
import { QrCode, Receipt, Trash2, Edit2, CalendarClock } from 'lucide-react';
import Button from '../common/Button';

// Memoized table status badge
const TableStatusBadge = memo(({ status, meta }) => {
  if (!meta) return null;

  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${meta.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </div>
  );
});

TableStatusBadge.displayName = 'TableStatusBadge';

// Memoized table info row
const TableInfoRow = memo(({ label, value }) => (
  <div className="flex items-center justify-between text-xs">
    <span className="text-slate-600 dark:text-slate-400">{label}</span>
    <span className="font-medium text-slate-900 dark:text-slate-100">{value}</span>
  </div>
));

TableInfoRow.displayName = 'TableInfoRow';

// Memoized table action buttons
const TableActions = memo(({ table, onQR, onEdit, onDelete, onReserve, onBill, canManage, canOpenBilling }) => (
  <div className="mt-4 flex flex-wrap gap-2">
    {canManage && (
      <>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => onQR(table)}
          className="flex-1 gap-1.5"
        >
          <QrCode className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">QR</span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => onEdit(table)}
          className="flex-1 gap-1.5"
        >
          <Edit2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Edit</span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => onDelete(table)}
          className="flex-1 gap-1.5"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Delete</span>
        </Button>
      </>
    )}

    {canOpenBilling && (
      <>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => onReserve(table)}
          className="flex-1 gap-1.5"
        >
          <CalendarClock className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Reserve</span>
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => onBill(table)}
          className="flex-1 gap-1.5"
        >
          <Receipt className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Bill</span>
        </Button>
      </>
    )}
  </div>
));

TableActions.displayName = 'TableActions';

// Main memoized table card
const TableCard = memo(
  ({
    table,
    statusMeta,
    groupedOrders,
    onQRClick,
    onEditClick,
    onDeleteClick,
    onReserveClick,
    onBillClick,
    onSelectTable,
    canManage,
    canOpenBilling,
  }) => {
    const tableOrders = groupedOrders[table.id] || [];
    const activeOrder = tableOrders[0];

    return (
      <div
        className={`group relative rounded-xl border p-4 transition-all duration-200 cursor-pointer hover:shadow-md ${statusMeta.card}`}
        onClick={() => onSelectTable(table)}
      >
        {/* Header */}
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {table.tableNumber}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {table.seatCapacity} Seats
            </p>
          </div>
          <TableStatusBadge status={table.status} meta={statusMeta} />
        </div>

        {/* Info */}
        <div className="mb-3 space-y-2">
          <TableInfoRow label="Location" value={table.location || '-'} />
          {activeOrder && (
            <TableInfoRow label="Order #" value={activeOrder.displayOrderNumber} />
          )}
        </div>

        {/* Actions */}
        <TableActions
          table={table}
          onQR={onQRClick}
          onEdit={onEditClick}
          onDelete={onDeleteClick}
          onReserve={onReserveClick}
          onBill={onBillClick}
          canManage={canManage}
          canOpenBilling={canOpenBilling}
        />
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison for better memoization
    return (
      prevProps.table.id === nextProps.table.id &&
      prevProps.table.status === nextProps.table.status &&
      prevProps.statusMeta === nextProps.statusMeta &&
      prevProps.groupedOrders[prevProps.table.id]?.length ===
        nextProps.groupedOrders[nextProps.table.id]?.length &&
      prevProps.canManage === nextProps.canManage &&
      prevProps.canOpenBilling === nextProps.canOpenBilling
    );
  }
);

TableCard.displayName = 'TableCard';

export default TableCard;
