# EXACT CODE CHANGES - Copy-Paste Ready

## File 1: backend/src/routes/customer.js

### Location of Change
Near the end of the file, find:
```javascript
// Create order as customer (no auth required, but table must be valid)
router.post('/orders', optionalAuth, orderController.createOrder);

export default router;
```

### Replace With
```javascript
// Create order as customer (no auth required, but table must be valid)
// This handles table resolution from tableNumber to tableId
router.post('/orders', optionalAuth, async (req, res, next) => {
  try {
    // If tableNumber is provided but not tableId, resolve it
    if (req.body.tableNumber && !req.body.tableId) {
      const { data: table, error: tableError } = await supabase
        .from('tables')
        .select('id, restaurant_id')
        .eq('table_number', parseInt(req.body.tableNumber))
        .single();

      if (tableError || !table) {
        return res.status(404).json({
          statusCode: 404,
          success: false,
          message: `Table ${req.body.tableNumber} not found`,
        });
      }

      // Add resolved IDs to request body
      req.body.tableId = table.id;
      req.restaurantId = table.restaurant_id;
      console.log(`✅ Resolved Table #${req.body.tableNumber} → ID: ${table.id}`);
    }

    // Call the order controller
    next();
  } catch (error) {
    console.error('❌ Error resolving table:', error.message);
    return res.status(500).json({
      statusCode: 500,
      success: false,
      message: 'Failed to process order',
    });
  }
}, orderController.createOrder);

export default router;
```

---

## File 2: backend/src/services/orderService.js

### Change 1: Update `createOrder()` method

Find:
```javascript
  static async createOrder(restaurantId, orderData) {
    try {
      // If restaurantId is not provided, look it up from the table
      let finalRestaurantId = restaurantId;
      if (!finalRestaurantId && orderData.tableId) {
        const { data: table, error: tableError } = await supabase
          .from('tables')
          .select('restaurant_id')
          .eq('id', orderData.tableId)
          .single();

        if (tableError || !table) {
          throw new Error('Table not found or invalid table ID');
        }

        finalRestaurantId = table.restaurant_id;
      }

      if (!finalRestaurantId) {
        throw new Error('Restaurant ID is required or table ID must be provided');
      }

      const { data: order, error } = await supabase
        .from('orders')
        .insert([{
          restaurant_id: finalRestaurantId,
          table_id: orderData.tableId,
          status: 'pending',
          total_amount: orderData.totalAmount || 0,
          payment_method: orderData.paymentMethod || 'cash',
          notes: orderData.notes || '',
        }])
        .select()
        .single();

      if (error) throw error;

      logger.info(`✅ Order created: ${order.id}`);
      return this.transformOrder(order);
    } catch (error) {
      logger.error('❌ Create order error:', error);
      throw error;
    }
  }
```

Replace With:
```javascript
  static async createOrder(restaurantId, orderData) {
    try {
      // If restaurantId is not provided, look it up from the table
      let finalRestaurantId = restaurantId;
      if (!finalRestaurantId && orderData.tableId) {
        const { data: table, error: tableError } = await supabase
          .from('tables')
          .select('restaurant_id')
          .eq('id', orderData.tableId)
          .single();

        if (tableError || !table) {
          throw new Error('Table not found or invalid table ID');
        }

        finalRestaurantId = table.restaurant_id;
      }

      if (!finalRestaurantId) {
        throw new Error('Restaurant ID is required or table ID must be provided');
      }

      const { data: order, error } = await supabase
        .from('orders')
        .insert([{
          restaurant_id: finalRestaurantId,
          table_id: orderData.tableId,
          status: 'pending',
          total_amount: orderData.totalAmount || 0,
          payment_method: orderData.paymentMethod || 'cash',
          notes: orderData.notes || '',
        }])
        .select()
        .single();

      if (error) throw error;

      logger.info(`✅ Order created: ${order.id}`);

      // If items are provided, add them to the order
      if (orderData.items && orderData.items.length > 0) {
        await this.addOrderItems(order.id, orderData.items);
      }

      // Fetch and return the complete order with items
      const completeOrder = await this.getOrderById(finalRestaurantId, order.id);
      
      return completeOrder;
    } catch (error) {
      logger.error('❌ Create order error:', error);
      throw error;
    }
  }
```

---

### Change 2: Update `getOrderById()` method

Find:
```javascript
  static async getOrderById(restaurantId, orderId) {
    try {
      const { data: order, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            menu_item_id,
            quantity,
            unit_price
          )
        `)
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (error || !order) throw error || new Error('Order not found');

      return this.transformOrder(order);
    } catch (error) {
      logger.error('❌ Get order error:', error);
      throw error;
    }
  }
```

Replace With:
```javascript
  static async getOrderById(restaurantId, orderId) {
    try {
      const { data: order, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            menu_item_id,
            quantity,
            unit_price
          ),
          tables!table_id (
            table_number
          )
        `)
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (error || !order) throw error || new Error('Order not found');

      // Transform and include table information
      const transformedOrder = this.transformOrder(order);
      return {
        ...transformedOrder,
        tableNumber: order.tables?.table_number || null,
        table: order.tables,
      };
    } catch (error) {
      logger.error('❌ Get order error:', error);
      throw error;
    }
  }
```

---

### Change 3: Update `getOrdersByRestaurant()` method

Find:
```javascript
  static async getOrdersByRestaurant(restaurantId, filters = {}) {
    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            menu_item_id,
            quantity,
            unit_price
          )
        `)
        .eq('restaurant_id', restaurantId);

      // ... rest of method
      
      const { data: orders, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      return this.transformOrders(orders);
    } catch (error) {
      logger.error('❌ Get orders error:', error);
      throw error;
    }
  }
```

Replace With:
```javascript
  static async getOrdersByRestaurant(restaurantId, filters = {}) {
    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            menu_item_id,
            quantity,
            unit_price
          ),
          tables!table_id (
            table_number
          )
        `)
        .eq('restaurant_id', restaurantId);

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.tableId) {
        query = query.eq('table_id', filters.tableId);
      }

      if (filters.startDate && filters.endDate) {
        query = query
          .gte('created_at', filters.startDate)
          .lte('created_at', filters.endDate);
      }

      const { data: orders, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      // Transform and include tableNumber for easier consumption
      return (orders || []).map(order => ({
        ...this.transformOrder(order),
        tableNumber: order.tables?.table_number || null,
        table: order.tables,
      }));
    } catch (error) {
      logger.error('❌ Get orders error:', error);
      throw error;
    }
  }
```

---

### Change 4: Update `getOrders()` method

Find:
```javascript
  static async getOrders(restaurantId, filters = {}) {
    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            menu_item_id,
            quantity,
            unit_price
          )
        `)
        .eq('restaurant_id', restaurantId);

      // ... rest of method
      
      const { data: orders, error } = await query
        .order('created_at', { ascending: false })
        .range(filters.skip || 0, (filters.skip || 0) + (filters.limit || 50) - 1);

      if (error) throw error;

      return {
        items: orders || [],
        total: orders?.length || 0,
        limit: filters.limit || 50,
        skip: filters.skip || 0,
      };
    } catch (error) {
      logger.error('❌ Get orders error:', error);
      throw error;
    }
  }
```

Replace With:
```javascript
  static async getOrders(restaurantId, filters = {}) {
    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            menu_item_id,
            quantity,
            unit_price
          ),
          tables!table_id (
            table_number
          )
        `)
        .eq('restaurant_id', restaurantId);

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.tableNumber) {
        query = query.eq('table_number', filters.tableNumber);
      }

      if (filters.startDate && filters.endDate) {
        query = query
          .gte('created_at', filters.startDate)
          .lte('created_at', filters.endDate);
      }

      const { data: orders, error } = await query
        .order('created_at', { ascending: false })
        .range(filters.skip || 0, (filters.skip || 0) + (filters.limit || 50) - 1);

      if (error) throw error;

      // Transform to include tableNumber
      const transformedOrders = (orders || []).map(order => ({
        ...this.transformOrder(order),
        tableNumber: order.tables?.table_number || null,
        table: order.tables,
      }));

      return {
        items: transformedOrders,
        total: transformedOrders?.length || 0,
        limit: filters.limit || 50,
        skip: filters.skip || 0,
      };
    } catch (error) {
      logger.error('❌ Get orders error:', error);
      throw error;
    }
  }
```

---

### Change 5: Update `getKitchenOrders()` method

Find:
```javascript
  static async getKitchenOrders(restaurantId, filters = {}) {
    try {
      const statuses = filters.statuses || ['pending', 'preparing'];
      
      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            menu_item_id,
            quantity,
            unit_price
          )
        `)
        .eq('restaurant_id', restaurantId)
        .in('status', statuses)
        .order('created_at', { ascending: true });

      const { data: orders, error } = await query;

      if (error) throw error;

      return orders || [];
    } catch (error) {
      logger.error('❌ Get kitchen orders error:', error);
      throw error;
    }
  }
```

Replace With:
```javascript
  static async getKitchenOrders(restaurantId, filters = {}) {
    try {
      const statuses = filters.statuses || ['pending', 'preparing'];
      
      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            menu_item_id,
            quantity,
            unit_price
          ),
          tables!table_id (
            table_number
          )
        `)
        .eq('restaurant_id', restaurantId)
        .in('status', statuses)
        .order('created_at', { ascending: true });

      const { data: orders, error } = await query;

      if (error) throw error;

      // Transform to include tableNumber for easier consumption
      return (orders || []).map(order => ({
        ...this.transformOrder(order),
        tableNumber: order.tables?.table_number || null,
        table: order.tables,
      }));
    } catch (error) {
      logger.error('❌ Get kitchen orders error:', error);
      throw error;
    }
  }
```

---

## File 3: backend/src/services/kitchenService_supabase.js

### Change 1: Update `getPendingOrders()` method

Find:
```javascript
  static async getPendingOrders(restaurantId) {
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          table_id,
          status,
          created_at,
          order_items (
            id,
            quantity,
            menu_item_id
          )
        `)
        .eq('restaurant_id', restaurantId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) throw error;

      return orders || [];
    } catch (error) {
      logger.error('❌ Get pending orders error:', error);
      throw error;
    }
  }
```

Replace With:
```javascript
  static async getPendingOrders(restaurantId) {
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          table_id,
          status,
          created_at,
          order_items (
            id,
            quantity,
            menu_item_id
          ),
          tables!table_id (
            table_number
          )
        `)
        .eq('restaurant_id', restaurantId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Transform to include tableNumber for easier consumption
      return (orders || []).map(order => ({
        ...order,
        tableNumber: order.tables?.table_number || null,
        table: order.tables,
      }));
    } catch (error) {
      logger.error('❌ Get pending orders error:', error);
      throw error;
    }
  }
```

---

### Change 2: Update `getOrdersInProgress()` method

Find:
```javascript
  static async getOrdersInProgress(restaurantId) {
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          table_id,
          status,
          created_at,
          order_items (
            id,
            quantity,
            menu_item_id
          )
        `)
        .eq('restaurant_id', restaurantId)
        .eq('status', 'in_progress')
        .order('created_at', { ascending: true });

      if (error) throw error;

      return orders || [];
    } catch (error) {
      logger.error('❌ Get in-progress orders error:', error);
      throw error;
    }
  }
```

Replace With:
```javascript
  static async getOrdersInProgress(restaurantId) {
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          table_id,
          status,
          created_at,
          order_items (
            id,
            quantity,
            menu_item_id
          ),
          tables!table_id (
            table_number
          )
        `)
        .eq('restaurant_id', restaurantId)
        .eq('status', 'in_progress')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Transform to include tableNumber for easier consumption
      return (orders || []).map(order => ({
        ...order,
        tableNumber: order.tables?.table_number || null,
        table: order.tables,
      }));
    } catch (error) {
      logger.error('❌ Get in-progress orders error:', error);
      throw error;
    }
  }
```

---

### Change 3: Update `getOrderDetails()` method

Find:
```javascript
  static async getOrderDetails(restaurantId, orderId) {
    try {
      const { data: order, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            menu_item_id,
            quantity,
            unit_price
          )
        `)
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (error || !order) throw error || new Error('Order not found');

      return order;
    } catch (error) {
      logger.error('❌ Get order details error:', error);
      throw error;
    }
  }
```

Replace With:
```javascript
  static async getOrderDetails(restaurantId, orderId) {
    try {
      const { data: order, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            menu_item_id,
            quantity,
            unit_price
          ),
          tables!table_id (
            table_number
          )
        `)
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (error || !order) throw error || new Error('Order not found');

      // Add tableNumber for easier consumption
      return {
        ...order,
        tableNumber: order.tables?.table_number || null,
        table: order.tables,
      };
    } catch (error) {
      logger.error('❌ Get order details error:', error);
      throw error;
    }
  }
```

---

## Summary of All Changes

| File | Method | Change |
|------|--------|--------|
| customer.js | POST /orders | Add table resolution middleware |
| orderService.js | createOrder | Auto-add items + return complete order |
| orderService.js | getOrderById | Add table join |
| orderService.js | getOrdersByRestaurant | Add table join |
| orderService.js | getOrders | Add table join |
| orderService.js | getKitchenOrders | Add table join |
| kitchenService_supabase.js | getPendingOrders | Add table join |
| kitchenService_supabase.js | getOrdersInProgress | Add table join |
| kitchenService_supabase.js | getOrderDetails | Add table join |

**Total changes**: 9 method updates across 3 files.

---

## Verification Checklist

After making all changes:

- [ ] customer.js has middleware before orderController.createOrder
- [ ] All Supabase select queries include `, tables!table_id (table_number)`
- [ ] All responses map orders with `tableNumber:` field
- [ ] No TypeScript/syntax errors
- [ ] Backend still starts: `npm run dev`
- [ ] Test order creation: Check logs for "✅ Resolved Table"
- [ ] Test kitchen: Check orders include tableNumber
- [ ] Deploy: `git push origin main`

**All set!** ✅
