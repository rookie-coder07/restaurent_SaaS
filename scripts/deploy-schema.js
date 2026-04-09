#!/usr/bin/env node

/**
 * Automatic Activity Schema Deployment
 * Deploys activity_logs table to Supabase using direct authenticated requests
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const SQL = `
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_restaurant ON activity_logs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_restaurant_user ON activity_logs(restaurant_id, user_id);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "activity_logs_select_restaurant" ON activity_logs
FOR SELECT USING (restaurant_id = auth.jwt() ->> 'restaurant_id');

CREATE POLICY IF NOT EXISTS "activity_logs_insert_restaurant" ON activity_logs
FOR INSERT WITH CHECK (restaurant_id = auth.jwt() ->> 'restaurant_id');
`;

async function deploySql() {
  console.log('\n🚀 Deploying Activity Schema to Supabase');
  console.log('========================================\n');
  
  try {
    // Extract host from URL
    const url = new URL(SUPABASE_URL);
    const host = url.hostname;
    const projectId = host.split('.')[0];
    
    console.log(`📍 Target: ${projectId}.supabase.co`);
    console.log(`📊 Statements: 8 (1 table, 4 indexes, 1 RLS, 2 policies)\n`);
    
    // Call the SQL API
    const options = {
      hostname: host,
      port: 443,
      path: '/rest/v1/rpc/query',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              console.log('✅ Schema deployment successful!\n');
              resolve(true);
            } else if (res.statusCode === 404) {
              console.log('⚠️  RPC not available, trying direct query...');
              deploySqlDirect().then(resolve).catch(reject);
            } else {
              console.error('❌ Error:', result.message || data);
              reject(new Error(result.message || 'Unknown error'));
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.write(JSON.stringify({ sql: SQL }));
      req.end();
    });

  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    throw error;
  }
}

async function deploySqlDirect() {
  console.log('\n📖 Manual Deployment Required\n');
  console.log('Please run this SQL in Supabase Dashboard:\n');
  console.log('1. Go to: https://supabase.com/dashboard');
  console.log('2. Select your project');
  console.log('3. Click: SQL Editor → New Query');
  console.log('4. Paste this SQL:\n');
  console.log('----------------------------------------');
  console.log(SQL);
  console.log('----------------------------------------\n');
  console.log('5. Click Run and wait for completion');
  console.log('6. Then restart backend: npm start\n');
  
  return false;
}

async function verifyTable() {
  console.log('📋 Verifying table...\n');
  
  const url = new URL(SUPABASE_URL);
  const host = url.hostname;
  
  const options = {
    hostname: host,
    port: 443,
    path: '/rest/v1/activity_logs?select=*&limit=1',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'apikey': SUPABASE_SERVICE_KEY,
    }
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          const result = JSON.parse(data);
          console.log('✅ Table verified: activity_logs');
          console.log(`   Records: ${result.length}`);
          console.log(`   Status: Ready to use\n`);
          console.log('🎉 All done! Restart your backend:\n');
          console.log('   cd backend');
          console.log('   npm start\n');
          resolve(true);
        } else if (res.statusCode === 404) {
          console.log('❌ Table not found');
          console.log('   Please deploy the schema (see above)\n');
          resolve(false);
        } else {
          console.log('⚠️  Status: Unknown');
          resolve(false);
        }
      });
    });

    req.on('error', () => {
      console.log('⚠️  Could not verify (network error)\n');
      resolve(false);
    });
    req.end();
  });
}

async function main() {
  try {
    const success = await deploySql();
    if (success) {
      await verifyTable();
    }
  } catch (error) {
    await deploySqlDirect();
  }
}

main();
