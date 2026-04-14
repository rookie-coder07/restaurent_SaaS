#!/usr/bin/env node

/**
 * Migration Script: Print SQL to apply database indexes for is_deleted filters
 * 
 * SQL must be applied manually via Supabase SQL Editor. Run this script to:
 * 1. Print the SQL commands
 * 2. Validate migration file exists
 * 3. Provide instructions for manual application
 * 
 * Run: node scripts/migrate-optimize-indexes.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.join(__dirname, '../src/config/migrations/2026-04-14-optimize-is_deleted-filters.sql');

// Read the migration file
if (!fs.existsSync(migrationPath)) {
  console.error('❌ Migration file not found:', migrationPath);
  process.exit(1);
}

const sql = fs.readFileSync(migrationPath, 'utf-8');

console.log('🔧 Database Index Optimization Migration');
console.log('═'.repeat(60));
console.log('\n📊 SQL to Apply:\n');
console.log(sql);
console.log('\n' + '═'.repeat(60));
console.log('\n📋 Instructions:');
console.log('1. Go to Supabase Dashboard → SQL Editor');
console.log('2. Click "New Query"');
console.log('3. Copy and paste the SQL above');
console.log('4. Click "Run"');
console.log('5. Wait for success message\n');
console.log('⏱️ Note: Indexes may take 1-2 minutes to fully apply\n');

// Print summary
const indexCount = (sql.match(/CREATE INDEX/gi) || []).length;
console.log(`✅ Ready to apply ${indexCount} indexes`);
console.log('📈 Expected improvements: 5-10x faster queries\n');
