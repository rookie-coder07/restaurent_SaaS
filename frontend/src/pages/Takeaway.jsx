import { useEffect } from 'react';
import TakeawayMenu from '../components/takeaway/TakeawayMenu';
import TakeawayCart from '../components/takeaway/TakeawayCart';
import { useTakeawayCart } from '../store/takeawayCartStore';
import { takeawayApi } from '../services/takeawayApi';
import { useApi } from '../hooks/useApi';
import { orderAPI } from '../services/apiEndpoints';

export default function Takeaway() {
  const { hydrateMenu, loadCategories } = useTakeawayCart();
  const { data: ordersData = {}, refetch: refetchOrders } = useApi(() =>
    orderAPI.getOrders({ limit: 20, orderType: 'takeaway' })
  );

  useEffect(() => {
    (async () => {
      const [cats, items] = await Promise.all([
        takeawayApi.fetchCategories(),
        takeawayApi.fetchItems(),
      ]);
      loadCategories(cats);
      hydrateMenu(items);
    })();
  }, [hydrateMenu, loadCategories]);

  return (
    <div className="grid gap-4 lg:grid-cols-[3fr_2fr] p-4 min-h-[calc(100vh-4rem)]">
      <TakeawayMenu />
      <TakeawayCart
        recentBills={(ordersData.items || []).filter((o) => String(o.paymentStatus || '').toLowerCase() === 'paid')}
        onRefresh={refetchOrders}
      />
    </div>
  );
}
