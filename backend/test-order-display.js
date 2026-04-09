#!/usr/bin/env node

/**
 * Test: Order Display Formatting
 * Shows user-friendly order output in console
 */

import {
  formatCurrency,
  formatOrderItems,
  formatOrderForConsole,
  formatOrderResponse,
  formatOrderSummaryTable,
  formatOrderNotification,
} from './src/utils/orderDisplay.js';

console.log('\n' + '='.repeat(60));
console.log('ORDER DISPLAY FORMATTER - TEST SUITE');
console.log('='.repeat(60));

// Sample order data
const sampleOrder = {
  orderId: '89443c21-415d-4054-b3e4-559aed616175',
  tableId: 'ff58c634-724a-45aa-8d59-d52066366f89',
  orderType: 'dine-in',
  itemCount: 3,
  totalAmount: 240,
  status: 'pending',
  createdAt: new Date().toISOString(),
};

const sampleItems = [
  { quantity: 1, unitPrice: 70, menuItemId: '07e507fd-7329-40e7-b95c-be727442d086' },
  { quantity: 1, unitPrice: 120, menuItemId: '20c4bd44-a197-40c6-95fb-2a1f92fbeafa' },
  { quantity: 1, unitPrice: 50, menuItemId: '997cf41c-ada4-4d32-8057-8d6ef2938e75' },
];

// Test 1: Currency Formatting
console.log('\n📊 TEST 1: Currency Formatting');
console.log('─'.repeat(60));
console.log(`Amount: ${formatCurrency(240)}`);
console.log(`Amount: ${formatCurrency(1299.99)}`);
console.log(`Amount: ${formatCurrency(0)}`);

// Test 2: Item Formatting
console.log('\n📊 TEST 2: Order Items Formatting');
console.log('─'.repeat(60));
console.log(formatOrderItems(sampleItems));

// Test 3: Full Order Console Display
console.log('\n📊 TEST 3: Full Order Console Display (User-Friendly)');
console.log('─'.repeat(60));
console.log(formatOrderForConsole(sampleOrder, sampleItems));

// Test 4: JSON Response Format
console.log('\n📊 TEST 4: JSON Response Format (API Response)');
console.log('─'.repeat(60));
console.log(JSON.stringify(formatOrderResponse(sampleOrder), null, 2));

// Test 5: Summary Table
console.log('\n📊 TEST 5: Summary Table Format');
console.log('─'.repeat(60));
console.log('┌─────────────────────────────────────────────────────────┐');
console.log(formatOrderSummaryTable(sampleOrder));
console.log('└─────────────────────────────────────────────────────────┘');

// Test 6: Quick Notification
console.log('\n📊 TEST 6: Quick Notification');
console.log('─'.repeat(60));
console.log(formatOrderNotification(sampleOrder));

console.log('\n' + '='.repeat(60));
console.log('✅ All formatting tests completed!');
console.log('='.repeat(60) + '\n');
