import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ShieldAlert } from 'lucide-react';
import { kitchenAPI } from '../services/apiEndpoints';
import { parseServerDate } from '../utils/formatters';
import { printKitchenTicket } from '../utils/kotPrint';
import { useManagerStore } from '../context/managerStore';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Toast from '../components/common/Toast';
import KOTHeader from '../components/kot/KOTHeader';
import ViewToggle from '../components/kot/ViewToggle';
import OrderCard from '../components/kot/OrderCard';

const POLLING_INTERVAL_MS = 5000;
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
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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
    let isMounted = true;

    const safeFetch = async (showLoader = false) => {
      try {
        await fetchOrders(showLoader);
      } catch {
        // handled in state
      }
    };

    safeFetch(true);
    const intervalId = window.setInterval(() => {
      if (isMounted) {
        safeFetch(false);
      }
    }, POLLING_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
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

  return (
    <div className="space-y-6">
      {success ? <Toast type="success" message={success} /> : null}
      {error ? <Toast type="error" message={error} /> : null}

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--color-text-subtle)]">Kitchen Control</p>
            <h1 className="mt-3 text-3xl font-bold text-[var(--color-text)]">Unified kitchen operations</h1>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">Live KOT queue, item view, reprint, re-fire, delays, and manager priority controls in one kitchen workspace.</p>
          </div>
        </div>
      </Card>

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

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <ViewToggle activeView={view} onChange={setView} />
        <div className="rounded-[1.25rem] border border-[var(--border-color)] bg-[var(--color-surface)] px-4 py-3 text-sm font-semibold text-[var(--text-secondary)] shadow-[var(--shadow-card)]">
          Auto refresh every 5 seconds
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-3 rounded-[1.5rem] border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-sm font-semibold text-rose-700 dark:text-rose-200">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-4 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-[22rem] animate-pulse rounded-[1.9rem] border border-[var(--border-color)] bg-[var(--color-surface)]" />
          ))}
        </div>
      ) : view === 'order' ? (
        tickets.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 xl:grid-cols-3">
            {STATUS_LANES.map((lane) => (
              <section
                key={lane.key}
                className="rounded-[1.9rem] border border-[var(--border-color)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-[var(--text-primary)]">{lane.title}</h2>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">{lane.subtitle}</p>
                  </div>
                  <span className="rounded-2xl bg-[var(--bg-card-muted)] px-3 py-2 text-lg font-black text-[var(--color-primary)]">
                    {groups[lane.key].length}
                  </span>
                </div>

                {groups[lane.key].length === 0 ? (
                  <div className="flex min-h-[12rem] items-center justify-center rounded-[1.5rem] border border-dashed border-[var(--border-color)] bg-[var(--color-panel)] px-4 text-center text-sm font-semibold text-[var(--text-secondary)]">
                    {lane.empty}
                  </div>
                ) : (
                  <div className="space-y-4">
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
            ))}
          </div>
        )
      ) : itemViewGroups.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {itemViewGroups.map((item) => (
            <article
              key={item.key}
              className="rounded-[1.9rem] border border-[var(--border-color)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]"
            >
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">Combined Item</p>
              <h2 className="mt-3 text-2xl font-black text-[var(--text-primary)]">{item.name}</h2>
              <p className="mt-5 text-5xl font-black text-[var(--color-primary)]">{item.quantity}x</p>
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
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[18rem] items-center justify-center rounded-[1.9rem] border border-dashed border-[var(--border-color)] bg-[var(--color-surface)] px-6 text-center shadow-[var(--shadow-card)]">
      <div>
        <p className="text-base font-black text-[var(--text-primary)]">No active kitchen tickets</p>
        <p className="mt-2 text-sm font-semibold text-[var(--text-secondary)]">
          Pending, preparing, and ready KOT actions will appear here automatically.
        </p>
      </div>
    </div>
  );
}
