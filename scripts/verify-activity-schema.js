#!/usr/bin/env node

/**
 * Verify that activity_logs table was successfully created in Supabase
 * Run this after deploying ACTIVITY_SCHEMA.sql
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function verifySchema() {
  console.log('\n🔍 Activity Logs Table Verification');
  console.log('====================================\n');
  
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    process.exit(1);
  }

  try {
    // Try to query the table
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/activity_logs?select=*&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = await response.json();

    if (response.status === 200) {
      console.log('✅ activity_logs table found and accessible!');
      console.log(`   Status: ${response.status}`);
      console.log(`   Records: ${Array.isArray(data) ? data.length : 0}`);
      console.log('\n✨ Schema deployment verified!\n');
      return true;
    }

    if (response.status === 404 || (data.message && data.message.includes('does not exist'))) {
      console.log('❌ activity_logs table not found');
      console.log('   The table has not been created yet.');
      console.log('\n📖 Please follow these steps:');
      console.log('   1. Open: https://supabase.com/dashboard');
      console.log('   2. Go to: SQL Editor > New Query');
      console.log('   3. Copy SQL from: ACTIVITY_SCHEMA.sql');
      console.log('   4. Execute and wait for success');
      console.log('   5. Re-run this verification script\n');
      return false;
    }

    console.log('⚠️  Unexpected response:', response.status);
    console.log('   Message:', data.message || data);
    return false;

  } catch (error) {
    console.error('❌ Connection error:', error.message);
    console.log('\n💡 Possible causes:');
    console.log('   • SUPABASE_URL or credentials are incorrect');
    console.log('   • Network connection issue');
    console.log('   • Supabase project is unavailable\n');
    return false;
  }
}

// Run verification
const success = await verifySchema();
process.exit(success ? 0 : 1);
