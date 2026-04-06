import { useState } from 'react';
import { useTakeawayCart } from '../../store/takeawayCartStore';
import { takeawayApi } from '../../services/takeawayApi';
import { formatCurrency } from '../../utils/formatters';

export default function TakeawayCart({ recentBills = [], onRefresh = () => {} }) {
  const {
    cart,
    subtotal,
    discount,
    tax,
    total,
    addItem,
    decreaseItem,
    removeItem,
    clearCart,
  } = useTakeawayCart();
  const [showCustomer, setShowCustomer] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const payloadBase = () => ({
    items: cart.map(({ id, name, price, qty }) => ({
      id,
      name,
      quantity: qty,
      price,
    })),
    subtotal,
    discount,
    tax,
    total,
    customerName: customerName.trim(),
    customerPhone: customerPhone.trim(),
    orderType: 'takeaway',
  });

  const handleSend = async () => {
    try {
      setLoading(true);
      setError('');
      await takeawayApi.createOrder(payloadBase());
      clearCart();
      onRefresh();
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Failed to send');
    } finally {
      setLoading(false);
    }
  };

  const handleSettle = async () => {
    try {
      setLoading(true);
      setError('');
      const order = await takeawayApi.createOrder(payloadBase());
      await takeawayApi.settleOrder(order.id, { paymentMode, amountReceived: total });
      clearCart();
      onRefresh();
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Failed to settle');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Cart</h3>
        <button onClick={clearCart} className="text-sm text-rose-600">Clear</button>
      </div>

      <div className="mt-3 space-y-3 overflow-y-auto">
        {cart.length === 0 ? (
          <p className="text-sm text-slate-500">Add items to start billing.</p>
        ) : (
          cart.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
              <div>
                <p className="font-semibold">{item.name}</p>
                <p className="text-xs text-slate-500">{formatCurrency(item.price)} each</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => decreaseItem(item.id)} className="h-8 w-8 rounded-full bg-slate-100">-</button>
                <span className="w-6 text-center font-semibold">{item.qty}</span>
                <button onClick={() => addItem(item)} className="h-8 w-8 rounded-full bg-slate-900 text-white">+</button>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatCurrency(item.qty * item.price)}</p>
                <button onClick={() => removeItem(item.id)} className="text-xs text-rose-500">Remove</button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 space-y-1 text-sm">
        <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
        <div className="flex justify-between text-slate-600"><span>Discount</span><span>-{formatCurrency(discount)}</span></div>
        <div className="flex justify-between text-slate-600"><span>Tax (CGST+SGST)</span><span>{formatCurrency(tax)}</span></div>
        <div className="flex justify-between text-lg font-bold"><span>Final Amount</span><span>{formatCurrency(total)}</span></div>
      </div>

      <button
        onClick={() => setShowCustomer((v) => !v)}
        className="mt-3 text-sm font-semibold text-slate-700 underline"
      >
        {showCustomer ? 'Hide Customer' : 'Add Customer'}
      </button>

      {showCustomer && (
        <div className="mt-2 space-y-2 text-sm">
          <input className="w-full rounded-xl border px-3 py-2" placeholder="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          <input className="w-full rounded-xl border px-3 py-2" placeholder="Phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
        </div>
      )}

      {error ? <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <div className="mt-auto grid gap-2 sm:grid-cols-2">
        <button
          onClick={handleSend}
          disabled={!cart.length || loading}
          className="h-12 rounded-xl bg-slate-900 text-white font-semibold"
        >
          {loading ? '...' : 'Send to Kitchen'}
        </button>
        <button
          onClick={handleSettle}
          disabled={!cart.length || loading}
          className="h-12 rounded-xl bg-emerald-600 text-white font-semibold"
        >
          {loading ? '...' : 'Create Bill'}
        </button>
      </div>

      <div className="mt-3 text-xs text-slate-500 space-y-2">
        <p>Payment Mode</p>
        <div className="flex gap-2">
          {['cash', 'upi', 'card'].map((mode) => (
            <button
              key={mode}
              onClick={() => setPaymentMode(mode)}
              className={`px-3 py-2 rounded-xl text-sm font-semibold ${
                paymentMode === mode ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {mode.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">Recent Takeaway Bills</p>
          <button onClick={onRefresh} className="text-xs font-semibold text-emerald-700">Refresh</button>
        </div>
        {recentBills.length === 0 ? (
          <p className="text-xs text-slate-500">No takeaway bills yet.</p>
        ) : (
          <div className="space-y-2 text-xs">
            {recentBills.map((bill) => (
              <div key={bill.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <div>
                  <p className="font-semibold text-slate-800">{bill.invoiceNumber || bill.serial || bill.id?.slice(0, 6)}</p>
                  <p className="text-[11px] text-slate-500">{bill.customerName || 'Walk-in'} • {bill.paymentMode || 'N/A'}</p>
                </div>
                <p className="font-semibold text-slate-900">{formatCurrency(bill.total || bill.finalAmount || 0)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
