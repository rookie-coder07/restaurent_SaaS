import { useMemo, useState } from 'react';
import { AlertTriangle, Loader, PackagePlus, PencilRuler, Plus } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { inventoryAPI } from '../services/apiEndpoints';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import StatCard from '../components/common/StatCard';
import EmptyState from '../components/common/EmptyState';

function createItemForm() {
  return {
    name: '',
    quantity: '',
    unit: 'kg',
    threshold: '',
  };
}

function createStockForm(action = 'increase') {
  return {
    action,
    quantity: '',
    reason: '',
  };
}

const UNIT_OPTIONS = ['kg', 'g', 'litre', 'ml', 'pieces'];

export default function Inventory() {
  const {
    data: itemsData = {},
    loading,
    execute: refetchItems,
  } = useApi(inventoryAPI.getItems);
  const {
    data: summaryData = {},
    execute: refetchSummary,
  } = useApi(inventoryAPI.getSummary);

  const items = itemsData?.items || [];
  const lowStockItems = summaryData?.lowStockItems || [];
  const recentHistory = summaryData?.recentHistory || [];
  const topConsumedItems = summaryData?.topConsumedItems || [];

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [stockTarget, setStockTarget] = useState(null);
  const [itemForm, setItemForm] = useState(createItemForm());
  const [stockForm, setStockForm] = useState(createStockForm());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const totalStockAlerts = summaryData?.lowStockCount || 0;

  const healthyItems = useMemo(
    () => items.filter((item) => !item.isLowStock).length,
    [items]
  );

  const refreshAll = async () => {
    await Promise.all([refetchItems(), refetchSummary()]);
  };

  const openCreateModal = () => {
    setItemForm(createItemForm());
    setEditingItem(null);
    setShowCreateModal(true);
    setError('');
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setItemForm({
      name: item.name || '',
      quantity: String(item.quantity ?? ''),
      unit: item.unit || 'kg',
      threshold: String(item.threshold ?? ''),
    });
    setShowCreateModal(true);
    setError('');
  };

  const openAddStockModal = (item) => {
    setStockTarget(item);
    setStockForm(createStockForm('increase'));
    setShowStockModal(true);
    setError('');
  };

  const openAdjustModal = (item) => {
    setStockTarget(item);
    setStockForm(createStockForm('set'));
    setShowStockModal(true);
    setError('');
  };

  const handleSaveItem = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const payload = {
        name: itemForm.name.trim(),
        quantity: Number(itemForm.quantity),
        unit: itemForm.unit,
        threshold: Number(itemForm.threshold),
      };

      if (editingItem) {
        await inventoryAPI.updateItem(editingItem.id, payload);
        setSuccess('Inventory item updated successfully.');
      } else {
        await inventoryAPI.createItem(payload);
        setSuccess('Inventory item created successfully.');
      }

      setShowCreateModal(false);
      await refreshAll();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to save inventory item.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStockSubmit = async (event) => {
    event.preventDefault();

    if (!stockTarget?.id) {
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      if (stockForm.action === 'increase') {
        await inventoryAPI.addStock(stockTarget.id, {
          quantity: Number(stockForm.quantity),
          reason: stockForm.reason.trim(),
        });
        setSuccess(`Added stock for ${stockTarget.name}.`);
      } else {
        await inventoryAPI.adjustStock(stockTarget.id, {
          action: stockForm.action,
          quantity: Number(stockForm.quantity),
          reason: stockForm.reason.trim(),
        });
        setSuccess(`Adjusted stock for ${stockTarget.name}.`);
      }

      setShowStockModal(false);
      setStockTarget(null);
      await refreshAll();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to update stock.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {success ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {success}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <div className="absolute inset-y-0 right-0 w-40 bg-gradient-to-l from-amber-400/10 to-transparent" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--text-secondary)]">Inventory</p>
            <h1 className="mt-2 text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">Kitchen Stock Control</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              Track ingredients, set low-stock thresholds, add stock quickly, and keep recipes tied to real kitchen inventory.
            </p>
          </div>

          <Button className="w-full sm:w-auto" onClick={openCreateModal}>
            <Plus className="h-4 w-4" />
            Add Inventory Item
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="Inventory Items" value={items.length} subtitle="Active tracked ingredients" iconTone="bg-[var(--color-primary-soft)] text-[var(--color-primary)]" />
        <StatCard label="Low Stock" value={totalStockAlerts} subtitle="Needs attention" iconTone="bg-red-500/15 text-red-400" />
        <StatCard label="Healthy Stock" value={healthyItems} subtitle="Above threshold" iconTone="bg-emerald-500/15 text-emerald-400" />
        <StatCard label="Today Usage" value={topConsumedItems.length} subtitle="Tracked consumed items" iconTone="bg-amber-500/15 text-amber-400" />
      </div>

      {lowStockItems.length > 0 ? (
        <Card>
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-red-400" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Low stock alerts</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {lowStockItems.map((item) => (
                  <span
                    key={item.id}
                    className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-300"
                  >
                    {item.name}: {item.quantity} {item.unit}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          icon={PackagePlus}
          title="No inventory items yet"
          description="Create your first stock item so recipes and low-stock alerts can start working."
          action={
            <Button onClick={openCreateModal}>
              <Plus className="h-4 w-4" />
              Add Inventory Item
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(20rem,0.9fr)]">
          <div className="space-y-4">
            {items.map((item) => (
              <Card key={item.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-[var(--text-primary)]">{item.name}</h3>
                      {item.isLowStock ? (
                        <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-red-300">
                          Low stock
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-emerald-300">
                          Healthy
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">
                      Current stock: <span className="font-semibold text-[var(--text-primary)]">{item.quantity} {item.unit}</span> • Alert below {item.threshold} {item.unit}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">Last updated: {new Date(item.lastUpdated).toLocaleString()}</p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <Button variant="secondary" onClick={() => openEditModal(item)}>
                      <PencilRuler className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button variant="secondary" onClick={() => openAddStockModal(item)}>
                      <PackagePlus className="h-4 w-4" />
                      Add Stock
                    </Button>
                    <Button variant="secondary" onClick={() => openAdjustModal(item)}>
                      <AlertTriangle className="h-4 w-4" />
                      Adjust
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="space-y-4">
            <Card>
              <p className="text-sm text-[var(--text-secondary)]">Today&apos;s Usage</p>
              <h3 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">Top Consumed Items</h3>
              <div className="mt-4 space-y-3">
                {topConsumedItems.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">No automatic deductions have been recorded yet today.</p>
                ) : (
                  topConsumedItems.map((item) => (
                    <div key={item.inventoryItemId} className="rounded-2xl bg-[var(--bg-card-muted)] p-4">
                      <p className="font-semibold text-[var(--text-primary)]">{item.name}</p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">Used {item.totalUsed} {item.unit} today</p>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card>
              <p className="text-sm text-[var(--text-secondary)]">Recent Activity</p>
              <h3 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">Stock History</h3>
              <div className="mt-4 space-y-3">
                {recentHistory.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">Inventory changes will appear here once stock starts moving.</p>
                ) : (
                  recentHistory.slice(0, 10).map((entry) => (
                    <div key={entry.id} className="rounded-2xl bg-[var(--bg-card-muted)] p-4">
                      <p className="font-semibold text-[var(--text-primary)]">{entry.inventoryItemName}</p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        {entry.type} • {entry.quantityChange > 0 ? '+' : ''}{entry.quantityChange} {entry.unit}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {entry.reason || entry.source} • {new Date(entry.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      <Modal
        title={editingItem ? 'Edit Inventory Item' : 'Add Inventory Item'}
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSaveItem} className="space-y-4">
          <Input
            label="Item Name"
            value={itemForm.name}
            onChange={(event) => setItemForm((current) => ({ ...current, name: event.target.value }))}
            required
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Current Quantity"
              type="number"
              step="0.0001"
              min="0"
              value={itemForm.quantity}
              onChange={(event) => setItemForm((current) => ({ ...current, quantity: event.target.value }))}
              required
            />
            <label className="block space-y-2">
              <span className="text-sm font-medium text-[var(--text-primary)]">Unit</span>
              <select
                value={itemForm.unit}
                onChange={(event) => setItemForm((current) => ({ ...current, unit: event.target.value }))}
                className="input"
              >
                {UNIT_OPTIONS.map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </label>
          </div>
          <Input
            label="Low Stock Threshold"
            type="number"
            step="0.0001"
            min="0"
            value={itemForm.threshold}
            onChange={(event) => setItemForm((current) => ({ ...current, threshold: event.target.value }))}
            required
          />
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? 'Saving...' : editingItem ? 'Update Item' : 'Create Item'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        title={stockForm.action === 'increase' ? `Add Stock • ${stockTarget?.name || ''}` : `Adjust Stock • ${stockTarget?.name || ''}`}
        isOpen={showStockModal}
        onClose={() => setShowStockModal(false)}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleStockSubmit} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">Adjustment Type</span>
            <select
              value={stockForm.action}
              onChange={(event) => setStockForm((current) => ({ ...current, action: event.target.value }))}
              className="input"
            >
              <option value="increase">Increase stock</option>
              <option value="decrease">Decrease stock</option>
              <option value="set">Correct actual stock</option>
            </select>
          </label>

          <Input
            label={stockForm.action === 'set' ? 'Actual Stock' : 'Quantity'}
            type="number"
            step="0.0001"
            min="0"
            value={stockForm.quantity}
            onChange={(event) => setStockForm((current) => ({ ...current, quantity: event.target.value }))}
            required
          />

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">Reason</span>
            <textarea
              value={stockForm.reason}
              onChange={(event) => setStockForm((current) => ({ ...current, reason: event.target.value }))}
              className="input min-h-[100px] resize-y"
              placeholder="Optional note like received from vendor, wastage, or corrected after stock count."
            />
          </label>

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowStockModal(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Stock Update'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
