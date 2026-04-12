/**
 * Performance optimization: Add missing database indexes
 * Run once to improve query performance for order operations
 * 
 * Usage: node scripts/addPerformanceIndexes.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const INDEXES_TO_CREATE = [
  {
    name: 'idx_orders_restaurant_is_deleted',
    table: 'orders',
    columns: ['restaurant_id', 'is_deleted'],
    description: 'Speed up filtering by restaurant and soft-delete status'
  },
  {
    name: 'idx_orders_restaurant_status',
    table: 'orders',
    columns: ['restaurant_id', 'status'],
    description: 'Speed up filtering orders by status per restaurant'
  },
  {
    name: 'idx_orders_table_id',
    table: 'orders',
    columns: ['table_id', 'is_deleted'],
    description: 'Speed up checking active orders by table'
  },
  {
    name: 'idx_orders_waiter_id',
    table: 'orders',
    columns: ['waiter_id'],
    description: 'Speed up waiter activity queries'
  },
  {
    name: 'idx_order_items_order_id',
    table: 'order_items',
    columns: ['order_id'],
    description: 'Already crucial for order item fetching'
  },
  {
    name: 'idx_kitchen_tickets_order_id',
    table: 'kitchen_tickets',
    columns: ['order_id'],
    description: 'Speed up KOT ticket fetching'
  },
  {
    name: 'idx_kitchen_tickets_status',
    table: 'kitchen_tickets',
    columns: ['order_id', 'status'],
    description: 'Speed up pending KOT filtering'
  },
  {
    name: 'idx_tables_restaurant_status',
    table: 'tables',
    columns: ['restaurant_id', 'status'],
    description: 'Speed up table status queries'
  },
  {
    name: 'idx_activity_logs_restaurant_created',
    table: 'activity_logs',
    columns: ['restaurant_id', 'created_at DESC'],
    description: 'Speed up activity log retrieval by restaurant and date'
  },
  {
    name: 'idx_activity_logs_user',
    table: 'activity_logs',
    columns: ['user_id', 'created_at DESC'],
    description: 'Speed up activity log retrieval by user'
  }
];

async function createIndex(indexName, table, columns) {
  try {
    const columnList = columns.join(', ');
    const sql = `CREATE INDEX IF NOT EXISTS ${indexName} ON ${table} (${columnList})`;
    
    console.log(`Creating index: ${indexName}...`);
    
    const { error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      console.error(`❌ Failed to create ${indexName}:`, error.message);
      return false;
    }
    
    console.log(`✅ Index created: ${indexName}`);
    return true;
  } catch (error) {
    console.error(`❌ Error creating ${indexName}:`, error.message);
    return false;
  }
}

async function runIndexCreation() {
  console.log('🔧 Performance Index Optimizer\n');
  console.log(`Creating ${INDEXES_TO_CREATE.length} indexes...\n`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const index of INDEXES_TO_CREATE) {
    console.log(`\n📊 ${index.description}`);
    const success = await createIndex(index.name, index.table, index.columns);
    
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Success: ${successCount}/${INDEXES_TO_CREATE.length}`);
  if (failCount > 0) {
    console.log(`❌ Failed: ${failCount}/${INDEXES_TO_CREATE.length}`);
  }
  console.log('${'='.repeat(60)}\n');
}

runIndexCreation().catch(console.error);
