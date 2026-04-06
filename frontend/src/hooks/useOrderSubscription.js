import { useEffect, useRef } from 'react';
import supabase from '../config/supabase';

function buildRestaurantFilter(restaurantId) {
  return restaurantId ? `restaurant_id=eq.${restaurantId}` : undefined;
}

function getPayloadStatus(payload) {
  return String(payload?.new?.status || payload?.old?.status || '').trim().toLowerCase();
}

export const useOrderSubscription = (restaurantId, onOrderUpdate, status = null) => {
  const onOrderUpdateRef = useRef(onOrderUpdate);

  useEffect(() => {
    onOrderUpdateRef.current = onOrderUpdate;
  }, [onOrderUpdate]);

  useEffect(() => {
    if (!restaurantId || typeof onOrderUpdateRef.current !== 'function') {
      return undefined;
    }

    const normalizedStatus = String(status || '').trim().toLowerCase();
    const channel = supabase.channel(`orders:${restaurantId}:${normalizedStatus || 'all'}`);
    const handleEvent = (payload) => {
      if (normalizedStatus) {
        const payloadStatus = getPayloadStatus(payload);
        if (payloadStatus !== normalizedStatus) {
          return;
        }
      }

      onOrderUpdateRef.current?.(payload);
    };

    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: buildRestaurantFilter(restaurantId),
        },
        handleEvent
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, status]);
};

export const useOrderItemsSubscription = (orderId, onItemsUpdate) => {
  const onItemsUpdateRef = useRef(onItemsUpdate);

  useEffect(() => {
    onItemsUpdateRef.current = onItemsUpdate;
  }, [onItemsUpdate]);

  useEffect(() => {
    if (!orderId || typeof onItemsUpdateRef.current !== 'function') {
      return undefined;
    }

    const channel = supabase.channel(`order-items:${orderId}`);
    const handleEvent = (payload) => {
      const payloadOrderId = payload?.new?.order_id || payload?.old?.order_id;
      if (payloadOrderId !== orderId) {
        return;
      }

      onItemsUpdateRef.current?.(payload);
    };

    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_items',
        },
        handleEvent
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);
};

export const useOrderCountSubscription = (restaurantId, onCountUpdate) => {
  const onCountUpdateRef = useRef(onCountUpdate);
  const debounceTimeoutRef = useRef(null);

  useEffect(() => {
    onCountUpdateRef.current = onCountUpdate;
  }, [onCountUpdate]);

  useEffect(() => {
    if (!restaurantId || typeof onCountUpdateRef.current !== 'function') {
      return undefined;
    }

    const channel = supabase.channel(`order-counts:${restaurantId}`);
    const refetchCounts = async () => {
      try {
        const { data: orders, error } = await supabase
          .from('orders')
          .select('status')
          .eq('restaurant_id', restaurantId);

        if (error) {
          return;
        }

        const counts = {
          pending: (orders || []).filter((order) => order.status === 'pending').length,
          preparing: (orders || []).filter((order) => order.status === 'preparing').length,
          ready: (orders || []).filter((order) => order.status === 'ready').length,
          completed: (orders || []).filter((order) => order.status === 'completed').length,
        };

        onCountUpdateRef.current?.(counts);
      } catch {
        // Realtime count refresh should never break the UI.
      }
    };

    const scheduleRefetch = () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      debounceTimeoutRef.current = setTimeout(() => {
        refetchCounts();
      }, 250);
    };

    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: buildRestaurantFilter(restaurantId),
        },
        scheduleRefetch
      )
      .subscribe();

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);
};
