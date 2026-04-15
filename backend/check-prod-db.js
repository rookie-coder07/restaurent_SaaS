#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Production database
const prodSupabase = createClient(
  'https://byixbcsblvvndgxftnoc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5aXhiY3NibHZ2bmRneGZ0bm9jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcwOTg5NTQwMCwiZXhwIjoxOTk5OTk5OTk5fQ.RvSgaLN8c5RwHi5MrxI8D1vL8K3K8K3K8K3K8K3K8K8'
);

async function checkProdDatabase() {
  console.log('\n=== PRODUCTION DATABASE CHECK ===\n');

  // Check restaurants
  console.log('📍 Restaurants in production database:');
  const { data: restaurants, error: restError } = await prodSupabase
    .from('restaurants')
    .select('id, name, email, status')
    .limit(5);

  if (restError) {
    console.log('❌ Error fetching restaurants:', restError.message);
  } else if (restaurants && restaurants.length > 0) {
    restaurants.forEach(r => {
      console.log(`  ✓ ${r.email} - ${r.name} (${r.status})`);
    });
  } else {
    console.log('  ⚠️  No restaurants found');
  }

  // Check users
  console.log('\n📍 Users in production database:');
  const { data: users, error: userError } = await prodSupabase
    .from('users')
    .select('id, email, role, status')
    .limit(5);

  if (userError) {
    console.log('❌ Error fetching users:', userError.message);
  } else if (users && users.length > 0) {
    users.forEach(u => {
      console.log(`  ✓ ${u.email} - ${u.role} (${u.status})`);
    });
  } else {
    console.log('  ⚠️  No users found');
  }

  // Check Supabase Auth users count
  console.log('\n📍 Supabase Auth users in production:');
  const { data: authUsers, error: authError } = await prodSupabase.auth.admin.listUsers();
  
  if (authError) {
    console.log('❌ Error fetching auth users:', authError.message);
  } else {
    console.log(`  ✓ Total auth users: ${authUsers?.users?.length || 0}`);
    if (authUsers?.users && authUsers.users.length > 0) {
      authUsers.users.slice(0, 5).forEach(u => {
        console.log(`    - ${u.email} (${u.user_metadata?.name || 'no name'})`);
      });
    }
  }

  process.exit(0);
}

checkProdDatabase().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
