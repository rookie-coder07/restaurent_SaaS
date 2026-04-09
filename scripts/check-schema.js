#!/usr/bin/env node

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

async function deploySchema() {
  console.log('\n🚀 Deploying Activity Logs Schema\n');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    db: {
      schema: 'public'
    }
  });

  try {
    // Test connection
    const { error: connError } = await supabase.from('users').select('id').limit(1);
    if (connError && connError.code !== 'PGRST204') {
      throw new Error(`Connection failed: ${connError.message}`);
    }

    // Check if table exists
    console.log('📋 Checking for existing table...');
    const { error: checkError } = await supabase
      .from('activity_logs')
      .select('id')
      .limit(1);

    if (!checkError || checkError.code === 'PGRST204') {
      console.log('✅ Table already exists!\n');
      console.log('Ready to use. Restart backend with: npm start\n');
      process.exit(0);
    }

    if (checkError.code === 'PGRST116') {
      console.log('❌ Table not found - needs to be created\n');
      console.log('📖 Follow these steps to deploy:\n');
      console.log('1. Open: https://supabase.com/dashboard');
      console.log('2. Go to: SQL Editor → New Query');
      console.log('3. Copy and paste the SQL from: ACTIVITY_SCHEMA.sql');
      console.log('4. Click: Run');
      console.log('5. Restart backend: npm start\n');
      console.log('The SQL file is at: /ACTIVITY_SCHEMA.sql\n');
      process.exit(1);
    }

    console.log('⚠️  Unexpected error:', checkError.message);
    process.exit(1);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

deploySchema();
