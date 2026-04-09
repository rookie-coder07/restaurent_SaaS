import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function diagnoseFix() {
  console.log('🔍 DIAGNOSING TABLE ACCESS & WAITER ASSIGNMENTS\n');
  console.log('═'.repeat(70));

  // Get all staff
  const { data: staff } = await supabase
    .from('users')
    .select('id, name, email, assigned_tables')
    .eq('role', 'staff');

  console.log('\n📋 STAFF MEMBERS & ASSIGNMENTS:\n');
  staff.forEach((waiter) => {
    const assignedTableIds = (waiter.assigned_tables || []).filter(Boolean);
    console.log(`  👤 ${waiter.name} (${waiter.email})`);
    console.log(`     ID: ${waiter.id}`);
    console.log(`     Assigned Tables: ${assignedTableIds.length > 0 ? assignedTableIds.join(', ') : 'NONE'}`);
    console.log('');
  });

  // Get all tables
  const { data: tables } = await supabase
    .from('tables')
    .select('id, table_number, assigned_to, locked_by_qr')
    .order('table_number');

  console.log('\n📊 TABLE STATUS:\n');
  console.log('| Table | Assigned To | QR Locked |');
  console.log('|-------|-------------|-----------|');

  tables.forEach((table) => {
    const waiter = staff.find((w) => w.id === table.assigned_to);
    const waiterName = waiter ? waiter.name : 'NONE';
    const lockStatus = table.locked_by_qr ? '🔒 YES' : 'NO';
    console.log(`| ${String(table.table_number).padEnd(5)} | ${waiterName.padEnd(11)} | ${lockStatus} |`);
  });

  // Test scenario
  console.log('\n\n🧪 TEST SCENARIO:\n');
  const testWaiter = staff.find((w) => w.email === 'testwaiter@pos.com');
  if (testWaiter) {
    console.log(`✅ Test Waiter Found: ${testWaiter.name}`);
    console.log(`   ID: ${testWaiter.id}`);
    const testTables = (testWaiter.assigned_tables || []).filter(Boolean);
    console.log(`   Can access: ${testTables.length > 0 ? testTables.join(', ') : 'NO TABLES ASSIGNED'}`);

    if (testTables.length > 0) {
      const firstTable = testTables[0];
      const tableData = tables.find((t) => t.id === firstTable);
      if (tableData) {
        console.log(`\n   First table (${tableData.table_number}):`);
        console.log(`     - assigned_to: ${tableData.assigned_to}`);
        console.log(`     - locked_by_qr: ${tableData.locked_by_qr}`);
        console.log(`     - Can waiter access? ${tableData.assigned_to === testWaiter.id ? '✅ YES' : '❌ NO - LOCKED TO ANOTHER WAITER'}`);
      }
    }
  } else {
    console.log('❌ Test waiter not found. Available waiters:');
    staff.forEach((s) => console.log(`   - ${s.email}`));
  }

  console.log('\n' + '═'.repeat(70));
}

diagnoseFix().catch(console.error);
