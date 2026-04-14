const supabase = require('./src/config/supabase.js').default;

(async () => {
  try {
    console.log('🔧 Applying constraint fix...');

    // Drop the old index
    console.log('Dropping old index...');
    const { error: dropError } = await supabase
      .from('orders')
      .select('id')
      .limit(0);

    // Use raw SQL through Postgres function if available
    // For now, let's try using Supabase's built-in sql execution
    const sql = `
      DROP INDEX IF EXISTS public.idx_orders_one_open_bill_per_table CASCADE;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_one_open_bill_per_table
      ON public.orders (restaurant_id, table_id)
      WHERE table_id IS NOT NULL
        AND COALESCE(is_deleted, false) = false
        AND COALESCE(payment_status, 'pending') <> 'paid'
        AND status IN ('awaiting_waiter_approval', 'pending', 'preparing', 'ready', 'served', 'in_progress');
    `;

    // Try different approaches to execute SQL
    console.log('Attempting to execute SQL directly...');
    
    // Method 1: Try using the sql function if it exists
    if (typeof supabase.sql === 'function') {
      const result = await supabase.sql(sql);
      console.log('✅ SQL executed via sql function');
    } else {
      console.log('❌ supabase.sql is not available');
      console.log('Available Supabase methods:', Object.keys(supabase).filter(k => typeof supabase[k] === 'function').slice(0, 10));
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('Full error:', err);
    process.exit(1);
  }
})();
