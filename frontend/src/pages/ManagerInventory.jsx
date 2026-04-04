import { AlertTriangle, ClipboardList, Package } from 'lucide-react';
import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { inventoryAPI } from '../services/apiEndpoints';
import { useManagerStore } from '../context/managerStore';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import Toast from '../components/common/Toast';

export default function ManagerInventory() {
  const { data: itemsData = {} } = useApi(inventoryAPI.getItems);
  const { data: summaryData = {} } = useApi(inventoryAPI.getSummary);
  const requestStockRefill = useManagerStore((state) => state.requestStockRefill);
  const stockRequests = useManagerStore((state) => state.stockRequests);
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [success, setSuccess] = useState('');

  const items = itemsData?.items || [];
  const lowStockItems = summaryData?.lowStockItems || [];

  const submitRequest = () => {
    if (!selectedItem) {
      return;
    }

    requestStockRefill({
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      quantity,
      note,
    });
    setSuccess(`Refill request sent for ${selectedItem.name}.`);
    setSelectedItem(null);
    setQuantity('');
    setNote('');
  };

  return (
    <div className="space-y-6">
      {success ? <Toast type="success" message={success} /> : null}

      <Card>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--color-text-subtle)]">Limited Inventory</p>
        <h1 className="mt-3 text-3xl font-bold text-[var(--color-text)]">Monitor stock and request refills</h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">Managers can see current stock and raise refill requests, but cannot change core inventory records.</p>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5"><p className="text-sm text-[var(--text-secondary)]">Tracked items</p><p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{items.length}</p></Card>
        <Card className="p-5"><p className="text-sm text-[var(--text-secondary)]">Low stock alerts</p><p className="mt-2 text-3xl font-bold text-red-400">{lowStockItems.length}</p></Card>
        <Card className="p-5"><p className="text-sm text-[var(--text-secondary)]">Refill requests</p><p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{stockRequests.length}</p></Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr,0.7fr]">
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.id} className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2">
                    <Package className="h-4 w-4 text-[var(--color-primary)]" />
                    <h2 className="text-lg font-bold text-[var(--color-text)]">{item.name}</h2>
                  </div>
                  <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                    {item.quantity} {item.unit} available • threshold {item.threshold} {item.unit}
                  </p>
                  {item.isLowStock ? (
                    <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-400">
                      <AlertTriangle className="h-4 w-4" />
                      Low stock alert
                    </p>
                  ) : null}
                </div>
                <Button onClick={() => setSelectedItem(item)}>
                  <ClipboardList className="h-4 w-4" />
                  Request refill
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <Card>
          <p className="text-sm text-[var(--text-secondary)]">Recent requests</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">Refill log</h2>
          <div className="mt-4 space-y-3">
            {stockRequests.length === 0 ? <p className="text-sm text-[var(--text-secondary)]">No refill requests yet.</p> : null}
            {stockRequests.slice(0, 8).map((request) => (
              <div key={request.id} className="rounded-2xl bg-[var(--color-surface-muted)] p-4">
                <p className="font-semibold text-[var(--text-primary)]">{request.itemName}</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Qty: {request.quantity || 'Not specified'} • {request.status}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Modal title={selectedItem ? `Request refill for ${selectedItem.name}` : 'Request refill'} isOpen={Boolean(selectedItem)} onClose={() => setSelectedItem(null)} maxWidth="max-w-lg">
        <div className="space-y-4">
          <Input label="Requested quantity" type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">Note</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} className="input min-h-[110px] resize-y" placeholder="Example: dinner rush expected, refill before 7 PM." />
          </label>
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button variant="secondary" className="w-full sm:flex-1" onClick={() => setSelectedItem(null)}>Cancel</Button>
            <Button className="w-full sm:flex-1" onClick={submitRequest}>Send Request</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
