import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function clearStaleLocks() {
  console.log('🔍 Checking for stale QR locks...\n');

  // Get all locked tables
  const { data: lockedTables, error: lockedError } = await supabase
    .from('tables')
    .select('id, table_number, assigned_to, locked_by_qr')
    .eq('locked_by_qr', true);

  if (lockedError) {
    console.error('❌ Error fetching locked tables:', lockedError);
    return;
  }

  if (!lockedTables || lockedTables.length === 0) {
    console.log('✅ No QR-locked tables found!');
    return;
  }

  console.log(`Found ${lockedTables.length} QR-locked tables:\n`);
  lockedTables.forEach((table) => {
    console.log(`  Table ${table.table_number} (${table.id}): locked_by_qr=${table.locked_by_qr}, assigned_to=${table.assigned_to}`);
  });

  // Get all staff and their assignments
  const { data: staff, error: staffError } = await supabase
    .from('users')
    .select('id, name, assigned_tables, role')
    .eq('role', 'staff');

  if (staffError) {
    console.error('❌ Error fetching staff:', staffError);
    return;
  }

  console.log(`\n👥 Staff assignments (${staff.length} waiters):\n`);
  staff.forEach((s) => {
    const tables = (s.assigned_tables || []).filter(Boolean);
    console.log(`  ${s.name}: assigned to ${tables.length} tables - ${tables.join(', ') || 'none'}`);
  });

  // Clear stale locks
  console.log('\n🧹 Clearing ALL stale QR locks...\n');
  const { error: clearError } = await supabase
    .from('tables')
    .update({
      locked_by_qr: false,
      assigned_to: null,
      updated_at: new Date().toISOString(),
    })
    .eq('locked_by_qr', true);

  if (clearError) {
    console.error('❌ Error clearing locks:', clearError);
    return;
  }

  console.log('✅ All QR locks cleared!');

  // Verify all cleared
  const { data: confirmTables } = await supabase
    .from('tables')
    .select('id, locked_by_qr')
    .eq('locked_by_qr', true);

  if (!confirmTables || confirmTables.length === 0) {
    console.log('✅ Verification: No QR-locked tables remain');
  } else {
    console.log(`⚠️ Still ${confirmTables.length} locked tables`);
  }
}

clearStaleLocks().catch(console.error);
