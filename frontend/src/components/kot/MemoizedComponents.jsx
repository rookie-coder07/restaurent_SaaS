/**
 * Memoized KOT Components - Prevents unnecessary re-renders
 * Dramatically speeds up kitchen display during rapid KOT operations
 */

import { memo } from 'react';
import { AlertCircle, Clock, CheckCircle } from 'lucide-react';

const KOTItemRow = memo(function KOTItemRow({ item, quantity }) {
  return (
    <div className="flex justify-between items-center py-1.5 text-sm">
      <span className="font-medium">{item}</span>
      <span className="font-bold text-right w-8">{quantity}</span>
    </div>
  );
}, (prev, next) => prev.item === next.item && prev.quantity === next.quantity);

const KOTHeader = memo(function KOTHeader({ kotNo, orderNo, tableNo, time }) {
  return (
    <div className="text-xs py-2 space-y-1 border-b border-gray-600">
      <div className="flex justify-between">
        <span>KOT NO</span>
        <span className="font-bold">{kotNo}</span>
      </div>
      <div className="flex justify-between">
        <span>ORDER</span>
        <span className="font-bold">{orderNo}</span>
      </div>
      <div className="flex justify-between">
        <span>TABLE</span>
        <span className="font-bold">{tableNo}</span>
      </div>
      <div className="flex justify-between">
        <span>TIME</span>
        <span className="font-bold">{time}</span>
      </div>
    </div>
  );
}, (prev, next) => 
  prev.kotNo === next.kotNo &&
  prev.orderNo === next.orderNo &&
  prev.tableNo === next.tableNo &&
  prev.time === next.time
);

export const MemoizedKOTItemRow = KOTItemRow;
export const MemoizedKOTHeader = KOTHeader;

/**
 * OrderCard - Memoized to prevent re-render on parent updates
 */
export const OrderCard = memo(function OrderCard({ 
  order, 
  isSelected, 
  onClick, 
  onStatusChange, 
  elapsedMinutes,
  statusIcon,
  statusMeta 
}) {
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-lg border-2 transition p-4 ${
        isSelected
          ? 'border-blue-500 bg-blue-500/10'
          : 'border-gray-600 hover:border-gray-500'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <p className="font-bold text-white">{order.displayOrderNumber}</p>
          <p className="text-sm text-gray-300">Table: {order.tableNumber}</p>
        </div>
        <div className="text-right">
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${statusMeta.chipClass}`}>
            {statusIcon}
            {statusMeta.label}
          </div>
          <p className="text-xs text-gray-400 mt-1">{elapsedMinutes}m ago</p>
        </div>
      </div>

      <div className="mb-3 space-y-1 text-xs">
        {(order.items || []).slice(0, 3).map((item, i) => (
          <p key={i} className="text-gray-300">
            • {item.name} x{item.quantity}
          </p>
        ))}
        {order.items?.length > 3 && <p className="text-gray-400">+{order.items.length - 3} more</p>}
      </div>

      {onStatusChange && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStatusChange(order.id);
          }}
          className={`w-full py-2 rounded text-xs font-bold transition ${
            statusMeta.accentClass
          } text-black hover:opacity-90`}
        >
          Mark as {order.status === 'pending' ? 'Preparing' : 'Ready'}
        </button>
      )}
    </div>
  );
}, (prev, next) => 
  prev.order.id === next.order.id &&
  prev.isSelected === next.isSelected &&
  prev.order.status === next.order.status &&
  prev.elapsedMinutes === next.elapsedMinutes
);
