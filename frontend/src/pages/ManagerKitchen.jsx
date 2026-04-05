import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ShieldAlert } from 'lucide-react';
import { kitchenAPI } from '../services/apiEndpoints';
import { formatDate, formatDisplayOrderNumber, formatShortDisplayOrderNumber, parseServerDate } from '../utils/formatters';
import { printKitchenTicket } from '../utils/kotPrint';
import { useManagerStore } from '../context/managerStore';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import Toast from '../components/common/Toast';
import KOTHeader from '../components/kot/KOTHeader';
import ViewToggle from '../components/kot/ViewToggle';
import OrderCard from '../components/kot/OrderCard';

const STATUS_LANES = [
  { key: 'pending', title: 'Pending', subtitle: 'New KOTs and delta actions waiting to start', empty: 'No pending KOTs' },
  { key: 'preparing', title: 'Preparing', subtitle: 'Currently in progress', empty: 'Nothing is being prepared' },
  { key: 'ready', title: 'Ready', subtitle: 'Finished and waiting to serve', empty: 'No ready KOTs' },
];
const NEXT_STATUS = {
  pending: 'preparing',
  preparing: 'ready',
  ready: 'served',
};

function formatElapsed(createdAt) {
  const createdDate = parseServerDate(createdAt);
  if (!createdDate) {
    return 'Just now';
  }

  const diffMs = Date.now() - createdDate.getTime();
  const totalMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (totalMinutes < 60) {
    return `${totalMinutes}m ago`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m ago`;
}

function formatLastUpdated(value) {
  if (!value) {
    return 'Waiting...';
  }

  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(value);
}

function getAgeMinutes(createdAt) {
  const createdDate = parseServerDate(createdAt);
  if (!createdDate) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - createdDate.getTime()) / 60000));
}

function getAgeTone(createdAt) {
  const ageMinutes = getAgeMinutes(createdAt);
  if (ageMinutes >= 20) {
    return 'critical';
  }
  if (ageMinutes >= 10) {
    return 'warning';
  }
  return 'fresh';
}

function normalizeTicket(ticket) {
  return {
    ...ticket,
    id: ticket.id,
    orderId: ticket.orderId,
    tableNumber: ticket.tableNumber || null,
    displayOrderNumber: ticket.displayOrderNumber || '',
    items: (ticket.items || []).map((item) => ({
      ...item,
      quantity: item.quantity || item.qty || 0,
      name: item.name || 'Unknown item',
      modifiers: Array.isArray(item.modifiers) ? item.modifiers : [],
      station: item.station || 'Main Kitchen',
    })),
  };
}

export default function ManagerKitchen() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingTicketId, setUpdatingTicketId] = useState(null);
  const [printingTicketId, setPrintingTicketId] = useState(null);
  const [newTicketIds, setNewTicketIds] = useState([]);
  const [view, setView] = useState('order');
  const [activeMobileLane, setActiveMobileLane] = useState('pending');
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [detailOrder, setDetailOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const knownTicketIdsRef = useRef(new Set());
  const fetchInFlightRef = useRef(false);
  const prioritizedOrders = useManagerStore((state) => state.prioritizedOrders);
  const setOrderPriority = useManagerStore((state) => state.setOrderPriority);

  const fetchOrders = async (showLoader = false, { force = false } = {}) => {
    if (fetchInFlightRef.current && !force) {
      return tickets;
    }

    fetchInFlightRef.current = true;

    if (showLoader) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const response = await kitchenAPI.getActiveOrders();
      const activeTickets = (response.data?.data || []).map(normalizeTicket);
      const incomingIds = new Set(activeTickets.map((ticket) => ticket.id));
      const freshIds = activeTickets
        .filter((ticket) => !knownTicketIdsRef.current.has(ticket.id))
        .map((ticket) => ticket.id);

      if (freshIds.length > 0 && knownTicketIdsRef.current.size > 0) {
        setNewTicketIds((current) => Array.from(new Set([...current, ...freshIds])));
        window.setTimeout(() => {
          setNewTicketIds((current) => current.filter((id) => !freshIds.includes(id)));
        }, 12000);
      }

      knownTicketIdsRef.current = incomingIds;
      setTickets(activeTickets);
      setError('');
      setLastUpdatedAt(new Date());
      return activeTickets;
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to load active kitchen tickets.');
      throw requestError;
    } finally {
      fetchInFlightRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders(true).catch(() => {
      // handled in state
    });
  }, []);

  const groups = useMemo(
    () => ({
      pending: (tickets || []).filter((ticket) => ticket.status === 'pending'),
      preparing: (tickets || []).filter((ticket) => ticket.status === 'preparing'),
      ready: (tickets || []).filter((ticket) => ticket.status === 'ready'),
    }),
    [tickets]
  );

  const itemViewGroups = useMemo(() => {
    const grouped = new Map();

    tickets.forEach((ticket) => {
      ticket.items.forEach((item) => {
        const key = `${item.station || 'Main Kitchen'}:${item.menuItemId || item.name}`;
        const existing = grouped.get(key) || {
          key,
          name: item.name,
          quantity: 0,
          ticketIds: new Set(),
          tableNumbers: new Set(),
          station: item.station || 'Main Kitchen',
        };

        existing.quantity += item.quantity || 0;
        existing.ticketIds.add(ticket.id);
        if (ticket.tableNumber) {
          existing.tableNumbers.add(ticket.tableNumber);
        }

        grouped.set(key, existing);
      });
    });

    return Array.from(grouped.values()).sort((a, b) => b.quantity - a.quantity);
  }, [tickets]);

  useEffect(() => {
    if (view !== 'order') {
      return;
    }

    const laneKeys = STATUS_LANES.map((lane) => lane.key);
    const currentLaneHasTickets = (groups[activeMobileLane] || []).length > 0;

    if (currentLaneHasTickets) {
      return;
    }

    const nextAvailableLane = laneKeys.find((laneKey) => (groups[laneKey] || []).length > 0);

    if (nextAvailableLane && nextAvailableLane !== activeMobileLane) {
      setActiveMobileLane(nextAvailableLane);
    }
  }, [activeMobileLane, groups, view]);

  const handleAdvanceStatus = async (ticket) => {
    const nextStatus = NEXT_STATUS[ticket.status];
    if (!nextStatus || updatingTicketId === ticket.id) {
      return;
    }

    setUpdatingTicketId(ticket.id);
    setError('');

    try {
      setTickets((currentTickets) =>
        currentTickets
          .map((currentTicket) =>
            currentTicket.id === ticket.id ? { ...currentTicket, status: nextStatus } : currentTicket
          )
          .filter((currentTicket) => currentTicket.status !== 'served')
      );
      setNewTicketIds((current) => current.filter((id) => id !== ticket.id));

      await kitchenAPI.updateStatus(ticket.orderId, ticket.id, { status: nextStatus });
      setSuccess(`KOT moved to ${nextStatus}.`);
      fetchOrders(false, { force: true }).catch(() => {});
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to update KOT status.');
      fetchOrders(false, { force: true }).catch(() => {});
    } finally {
      setUpdatingTicketId(null);
    }
  };

  const handleReprint = async (ticket) => {
    if (printingTicketId === ticket.id) {
      return;
    }

    setPrintingTicketId(ticket.id);
    setError('');

    try {
      const response = await kitchenAPI.reprintTicket(ticket.orderId, ticket.id);
      const result = response.data?.data || {};
      const printableTicket = normalizeTicket(result.ticket || ticket);
      const didPrint = printKitchenTicket(printableTicket, {
        title: `${printableTicket.displayOrderNumber || 'KOT'}${printableTicket.tableNumber ? ` - Table ${printableTicket.tableNumber}` : ''}`,
      });

      if (!didPrint) {
        setError('Ticket updated, but the browser blocked the print window.');
      }

      setSuccess('Kitchen ticket reprinted.');
      fetchOrders(false, { force: true }).catch(() => {});
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to reprint kitchen ticket.');
    } finally {
      setPrintingTicketId(null);
    }
  };

  const handleRefire = async (ticket) => {
    if (updatingTicketId === ticket.id) {
      return;
    }

    setUpdatingTicketId(ticket.id);
    setError('');

    try {
      const response = await kitchenAPI.refireTicket(ticket.orderId, ticket.id);
      const result = response.data?.data || {};
      const printableTicket = normalizeTicket(result.ticket || ticket);
      printKitchenTicket(printableTicket, {
        title: `${printableTicket.displayOrderNumber || 'KOT'}${printableTicket.tableNumber ? ` - Table ${printableTicket.tableNumber}` : ''}`,
      });
      setSuccess('Kitchen ticket re-fired.');
      fetchOrders(false, { force: true }).catch(() => {});
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to re-fire kitchen ticket.');
    } finally {
      setUpdatingTicketId(null);
    }
  };

  const openTicketDetails = async (ticket) => {
    setSelectedTicket(ticket);
    setDetailOrder(null);
    setDetailLoading(true);
    setError('');

    try {
      const response = await kitchenAPI.getOrderDetail(ticket.orderId);
      setDetailOrder(response.data?.data || null);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to load kitchen order details.');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeTicketDetails = () => {
    setSelectedTicket(null);
    setDetailOrder(null);
    setDetailLoading(false);
  };

  const renderLane = (lane) => (
    <section
      key={lane.key}
      className="rounded-[1.4rem] border border-[var(--border-color)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)] sm:rounded-[1.9rem] sm:p-4"
    >
      <div className="mb-3 flex items-start justify-between gap-3 sm:mb-4">
        <div>
          <h2 className="text-lg font-black text-[var(--text-primary)] sm:text-xl">{lane.title}</h2>
          <p className="mt-1 hidden text-sm text-[var(--text-secondary)] sm:block">{lane.subtitle}</p>
        </div>
        <span className="rounded-2xl bg-[var(--bg-card-muted)] px-3 py-2 text-base font-black text-[var(--color-primary)] sm:text-lg">
          {groups[lane.key].length}
        </span>
      </div>

      {groups[lane.key].length === 0 ? (
        <div className="flex min-h-[9rem] items-center justify-center rounded-[1.2rem] border border-dashed border-[var(--border-color)] bg-[var(--color-panel)] px-4 text-center text-sm font-semibold text-[var(--text-secondary)] sm:min-h-[12rem] sm:rounded-[1.5rem]">
          {lane.empty}
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {groups[lane.key]
            .slice()
            .sort((left, right) => {
              const leftPriority = prioritizedOrders[left.orderId]?.priority === 'high' ? 1 : 0;
              const rightPriority = prioritizedOrders[right.orderId]?.priority === 'high' ? 1 : 0;
              if (leftPriority !== rightPriority) {
                return rightPriority - leftPriority;
              }
              return getAgeMinutes(right.createdAt) - getAgeMinutes(left.createdAt);
            })
            .map((ticket) => {
              const isPriority = prioritizedOrders[ticket.orderId]?.priority === 'high';

              return (
                <div key={ticket.id} className="space-y-3">
                  <OrderCard
                    ticket={ticket}
                    laneLabel={lane.title}
                    elapsedLabel={formatElapsed(ticket.createdAt)}
                    ageTone={getAgeTone(ticket.createdAt)}
                    isNewTicket={newTicketIds.includes(ticket.id)}
                    onViewDetails={openTicketDetails}
                    onAdvanceStatus={handleAdvanceStatus}
                    onReprint={handleReprint}
                    onRefire={handleRefire}
                    isUpdating={updatingTicketId === ticket.id}
                    isPrinting={printingTicketId === ticket.id}
                  />
                  <Button
                    variant={isPriority ? 'danger' : 'secondary'}
                    onClick={() => {
                      setOrderPriority(ticket.orderId, isPriority ? 'normal' : 'high');
                      setSuccess(isPriority ? 'Kitchen priority cleared.' : 'Kitchen priority applied.');
                    }}
                    className="w-full"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    {isPriority ? 'Clear Priority' : 'Prioritize Order'}
                  </Button>
                </div>
              );
            })}
        </div>
      )}
    </section>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {success ? <Toast type="success" message={success} /> : null}
      {error ? <Toast type="error" message={error} /> : null}

      <KOTHeader
        totalCount={tickets.length}
        pendingCount={groups.pending.length}
        preparingCount={groups.preparing.length}
        readyCount={groups.ready.length}
        lastUpdatedLabel={formatLastUpdated(lastUpdatedAt)}
        isRefreshing={refreshing}
        onRefresh={() => {
          fetchOrders(false).catch(() => {});
        }}
      />

      <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
        <ViewToggle activeView={view} onChange={setView} />
        <div className="w-full rounded-[1rem] border border-[var(--border-color)] bg-[var(--color-surface)] px-4 py-3 text-center text-sm font-semibold text-[var(--text-secondary)] shadow-[var(--shadow-card)] lg:w-auto lg:rounded-[1.25rem] lg:text-left">
          Auto refresh every 5 seconds
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:gap-4 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-[18rem] animate-pulse rounded-[1.4rem] border border-[var(--border-color)] bg-[var(--color-surface)] sm:h-[22rem] sm:rounded-[1.9rem]" />
          ))}
        </div>
      ) : view === 'order' ? (
        tickets.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-3 gap-2 sm:hidden">
              {STATUS_LANES.map((lane) => {
                const isActive = activeMobileLane === lane.key;
                return (
                  <button
                    key={lane.key}
                    type="button"
                    onClick={() => setActiveMobileLane(lane.key)}
                    className={`rounded-[1rem] border px-3 py-3 text-left transition ${
                      isActive
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                        : 'border-[var(--border-color)] bg-[var(--color-surface)] text-[var(--text-secondary)]'
                    }`}
                  >
                    <p className="text-xs font-bold uppercase tracking-[0.18em]">{lane.title}</p>
                    <p className="mt-1 text-xl font-black">{groups[lane.key].length}</p>
                  </button>
                );
              })}
            </div>

            <div className="sm:hidden">
              {renderLane(STATUS_LANES.find((lane) => lane.key === activeMobileLane) || STATUS_LANES[0])}
            </div>

            <div className="hidden gap-3 sm:grid sm:gap-4 xl:grid-cols-3">
              {STATUS_LANES.map((lane) => renderLane(lane))}
            </div>
          </div>
        )
      ) : itemViewGroups.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
          {itemViewGroups.map((item) => (
            <article
              key={item.key}
              className="rounded-[1.4rem] border border-[var(--border-color)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)] sm:rounded-[1.9rem] sm:p-5"
            >
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">Combined Item</p>
              <h2 className="mt-3 text-xl font-black text-[var(--text-primary)] sm:text-2xl">{item.name}</h2>
              <p className="mt-4 text-4xl font-black text-[var(--color-primary)] sm:mt-5 sm:text-5xl">{item.quantity}x</p>
              <p className="mt-4 text-sm font-semibold text-[var(--text-primary)]">{item.ticketIds.size} tickets</p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                {item.tableNumbers.size > 0
                  ? `Tables: ${Array.from(item.tableNumbers).sort((a, b) => a - b).join(', ')}`
                  : 'No table assigned'}
              </p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">Station: {item.station}</p>
            </article>
          ))}
        </div>
      )}

      <Modal
        title={selectedTicket ? `${formatShortDisplayOrderNumber(selectedTicket)} Kitchen Details` : 'Kitchen details'}
        isOpen={Boolean(selectedTicket)}
        onClose={closeTicketDetails}
        maxWidth="max-w-2xl"
      >
        {selectedTicket ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">Order</p>
                <p className="mt-2 text-base font-bold text-[var(--text-primary)]">
                  {detailOrder ? formatDisplayOrderNumber(detailOrder) : formatShortDisplayOrderNumber(selectedTicket)}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">Table</p>
                <p className="mt-2 text-base font-bold text-[var(--text-primary)]">
                  {detailOrder?.tableNumber || selectedTicket.tableNumber ? `Table ${detailOrder?.tableNumber || selectedTicket.tableNumber}` : 'Walk-in'}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">Created</p>
                <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                  {formatDate(detailOrder?.createdAt || selectedTicket.createdAt)}
                </p>
              </Card>
            </div>

            {detailLoading ? (
              <div className="flex min-h-[12rem] items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--color-surface)]">
                <div className="text-center">
                  <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
                  <p className="mt-3 text-sm font-medium text-[var(--text-secondary)]">Loading full kitchen details...</p>
                </div>
              </div>
            ) : (
              <>
                <Card className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Ticket items</p>
                    <span className="rounded-full bg-[var(--color-surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                      {selectedTicket.items?.length || 0} line(s)
                    </span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {(selectedTicket.items || []).map((item, index) => (
                      <div key={`${selectedTicket.id}-detail-item-${index}`} className="rounded-2xl bg-[var(--color-surface-muted)] p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="break-words font-semibold text-[var(--text-primary)]">{item.quantity}x {item.name}</p>
                            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">{item.station || 'Main Kitchen'}</p>
                          </div>
                          <span className="rounded-full border border-[var(--border-color)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                            {item.action || 'add'}
                          </span>
                        </div>
                        {item.modifiers?.length ? (
                          <p className="mt-2 text-sm text-[var(--text-secondary)]">{item.modifiers.join(', ')}</p>
                        ) : null}
                        {item.note ? <p className="mt-2 text-sm text-[var(--text-secondary)]">Note: {item.note}</p> : null}
                      </div>
                    ))}
                  </div>
                </Card>

                <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
                  <Card className="p-4">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Kitchen timeline</p>
                    <div className="mt-4 space-y-3">
                      {((detailOrder?.kitchenTickets || []).length > 0 ? detailOrder.kitchenTickets : [selectedTicket]).map((ticket) => (
                        <div key={ticket.id} className="rounded-2xl bg-[var(--color-surface-muted)] p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold text-[var(--text-primary)]">KOT #{ticket.sequence || 1}</p>
                            <span className="rounded-full px-2.5 py-1 text-xs font-semibold capitalize bg-[var(--color-panel)] text-[var(--text-secondary)]">
                              {ticket.status}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-[var(--text-secondary)]">{formatDate(ticket.createdAt)}</p>
                          <p className="mt-1 text-sm text-[var(--text-secondary)]">{ticket.summary || 'Kitchen action'}</p>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card className="p-4">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Order notes</p>
                    <div className="mt-4 rounded-2xl bg-[var(--color-surface-muted)] p-3">
                      <p className="text-sm leading-6 text-[var(--text-secondary)]">
                        {detailOrder?.notes || selectedTicket.summary || 'No additional notes for this kitchen order.'}
                      </p>
                    </div>
                  </Card>
                </div>
              </>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[14rem] items-center justify-center rounded-[1.4rem] border border-dashed border-[var(--border-color)] bg-[var(--color-surface)] px-5 text-center shadow-[var(--shadow-card)] sm:min-h-[18rem] sm:rounded-[1.9rem] sm:px-6">
      <div>
        <p className="text-base font-black text-[var(--text-primary)]">No active kitchen tickets</p>
        <p className="mt-2 text-sm font-semibold text-[var(--text-secondary)]">
          Pending, preparing, and ready KOT actions will appear here automatically.
        </p>
      </div>
    </div>
  );
}
