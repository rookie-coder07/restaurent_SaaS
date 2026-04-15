import supabase from '../src/config/supabase.js';

async function resetAllTables() {
  try {
    console.log('🧹 Starting table reset...\n');

    // 1. Get all order items and delete them
    console.log('Deleting order items...');
    const { data: items } = await supabase
      .from('order_items')
      .select('id');
    
    if (items && items.length > 0) {
      const itemIds = items.map(i => i.id);
      const { error: itemsError } = await supabase
        .from('order_items')
        .delete()
        .in('id', itemIds);
      if (itemsError) throw itemsError;
      console.log(`✅ Deleted ${items.length} order items\n`);
    } else {
      console.log('✅ No order items to delete\n');
    }

    // 2. Get all kitchen tickets and delete them
    console.log('Deleting kitchen tickets...');
    const { data: tickets } = await supabase
      .from('kitchen_tickets')
      .select('id');
    
    if (tickets && tickets.length > 0) {
      const ticketIds = tickets.map(t => t.id);
      const { error: ktsError } = await supabase
        .from('kitchen_tickets')
        .delete()
        .in('id', ticketIds);
      if (ktsError) throw ktsError;
      console.log(`✅ Deleted ${tickets.length} kitchen tickets\n`);
    } else {
      console.log('✅ No kitchen tickets to delete\n');
    }

    // 3. Get all orders and delete them
    console.log('Deleting all orders...');
    const { data: orders } = await supabase
      .from('orders')
      .select('id');
    
    if (orders && orders.length > 0) {
      const orderIds = orders.map(o => o.id);
      const { error: ordersError } = await supabase
        .from('orders')
        .delete()
        .in('id', orderIds);
      if (ordersError) throw ordersError;
      console.log(`✅ Deleted ${orders.length} orders\n`);
    } else {
      console.log('✅ No orders to delete\n');
    }

    // 4. Free up all tables
    console.log('Freeing up all tables...');
    const { data: tables } = await supabase
      .from('tables')
      .select('id');
    
    if (tables && tables.length > 0) {
      const tableIds = tables.map(t => t.id);
      const { error: tablesError } = await supabase
        .from('tables')
        .update({
          status: 'available',
          reserved_by: null,
          reservation_time: null,
          assigned_to: null,
        })
        .in('id', tableIds);
      if (tablesError) throw tablesError;
      console.log(`✅ Updated ${tables.length} tables to available\n`);
    } else {
      console.log('✅ No tables to update\n');
    }

    // 5. Deactivate all table assignments
    console.log('Deactivating table assignments...');
    const { data: assignments } = await supabase
      .from('table_assignments')
      .select('id');
    
    if (assignments && assignments.length > 0) {
      const assignmentIds = assignments.map(a => a.id);
      const { error: assignError } = await supabase
        .from('table_assignments')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .in('id', assignmentIds);
      if (assignError) throw assignError;
      console.log(`✅ Deactivated ${assignments.length} table assignments\n`);
    } else {
      console.log('✅ No table assignments to deactivate\n');
    }

    console.log('🎉 All tables are now free and ready!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

resetAllTables();
