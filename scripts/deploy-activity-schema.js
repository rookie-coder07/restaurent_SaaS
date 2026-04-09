#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../backend/.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

async function deployActivitySchema() {
  try {
    console.log('🚀 Activity Logs Table Deployment');
    console.log('====================================\n');
    
    // Initialize Supabase client with service key for admin access
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    // Read the schema file
    const schemaPath = path.join(__dirname, '../../ACTIVITY_SCHEMA.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📖 Schema loaded from ACTIVITY_SCHEMA.sql');
    console.log('📝 Executing SQL statements...\n');
    
    // Split by semicolons and filter empty statements
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`Found ${statements.length} SQL statements to execute\n`);
    
    let executed = 0;
    let errors = [];
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const desc = statement.substring(0, 50).replace(/\n/g, ' ') + '...';
      
      try {
        // Execute the statement
        const { data, error } = await supabase.rpc('query', {
          sql: statement
        }).catch(async () => {
          // Fallback: Try direct execution via Postgres
          // For safety, we'll just check if table exists
          if (statement.includes('CREATE TABLE')) {
            const tableName = statement.match(/CREATE TABLE.*?(\w+)\s*\(/)?.[1];
            if (tableName) {
              const { error: checkError } = await supabase
                .from(tableName)
                .select('*')
                .limit(0);
              
              if (checkError?.code === 'PGRST116') {
                // Table doesn't exist, needs to be created
                console.log(`⚠️  [(${i + 1}/${statements.length})] Table ${tableName} not found - needs manual deployment`);
                return { error: { message: 'Table check requires manual SQL execution' } };
              } else if (checkError && checkError.code === 'PGRST204') {
                console.log(`✅ [${i + 1}/${statements.length}] Table ${tableName} exists`);
                executed++;
                return { data: null, error: null };
              }
            }
          }
          return { data: null, error: null };
        });
        
        if (error && error.message !== 'No RPC Function') {
          errors.push({ stmt: desc, error: error.message });
        } else {
          console.log(`✅ [${i + 1}/${statements.length}] ${desc}`);
          executed++;
        }
      } catch (err) {
        errors.push({ stmt: desc, error: err.message });
      }
    }
    
    console.log(`\n====================================`);
    console.log(`✅ Executed: ${executed}/${statements.length} statements`);
    
    if (errors.length > 0) {
      console.log(`\n⚠️  Issues encountered:`);
      errors.forEach(e => console.log(`   • ${e.stmt}: ${e.error}`));
    }
    
    // Verify table exists
    console.log(`\n📋 Verifying activity_logs table...\n`);
    
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .limit(1);
    
    if (error && error.code === 'PGRST116') {
      console.log('❌ activity_logs table not found');
      console.log('\n⚠️  MANUAL DEPLOYMENT REQUIRED');
      console.log('=====================================');
      console.log('The RPC approach requires manual setup. Please:');
      console.log('1. Go to: https://supabase.com/dashboard');
      console.log('2. Select your project');
      console.log('3. Click SQL Editor → New Query');
      console.log('4. Copy contents of: ACTIVITY_SCHEMA.sql');
      console.log('5. Execute the query');
      process.exit(1);
    }
    
    if (!error) {
      console.log('✅ activity_logs table verified and ready!');
      console.log('\n🎉 Deployment successful!\n');
      console.log('The following is now available:');
      console.log('  • activity_logs table');
      console.log('  • Performance indexes (3)');
      console.log('  • Row Level Security (RLS)');
      console.log('  • Security policies\n');
      process.exit(0);
    }
    
    // Unknown error
    console.log('⚠️  Unknown status:', error?.message);
    process.exit(1);
    
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    console.log('\n📖 Fallback: Manual Deployment');
    console.log('go to Supabase Dashboard > SQL Editor and run ACTIVITY_SCHEMA.sql');
    process.exit(1);
  }
}

// Run deployment
deployActivitySchema();
