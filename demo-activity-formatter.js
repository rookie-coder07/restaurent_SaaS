/**
 * Activity Details Formatter - Demo
 * Shows how activity is transformed from raw JSON to user-friendly format
 */

console.log('\n' + '='.repeat(70));
console.log('STAFF ACTIVITY TIMELINE - BEFORE & AFTER FORMATTING');
console.log('='.repeat(70));

// Demo transformations

const activities = [
  {
    title: '📋 Order Created',
    timestamp: 'Apr 9, 2026, 05:37:30 PM',
    before: {
      orderId: '89443c21-415d-4054-b3e4-559aed616175',
      tableId: 'ff58c634-724a-45aa-8d59-d52066366f89',
      itemCount: 3,
      orderType: 'dine-in',
      totalAmount: 240
    },
    after: [
      'Order: #75',
      'Table: Table 5',
      'Items: 3',
      'Total: ₹240',
      'Type: dine-in',
      '',
      '✨ ₹240'
    ]
  },
  {
    title: '➕ Item Added',
    timestamp: 'Apr 9, 2026, 05:37:31 PM',
    before: {
      items: [
        { quantity: 1, unitPrice: 70, menuItemId: '07e507fd-7329-40e7-b95c-be727442d086' },
        { quantity: 1, unitPrice: 120, menuItemId: '20c4bd44-a197-40c6-95fb-2a1f92fbeafa' },
        { quantity: 1, unitPrice: 50, menuItemId: '997cf41c-ada4-4d32-8057-8d6ef2938e75' }
      ],
      orderId: '89443c21-415d-4054-b3e4-559aed616175',
      itemCount: 3,
      displayOrderNumber: '#75'
    },
    after: [
      'Order: #75',
      'Items Added: 3',
      'Total Value: ₹240',
      'Items: 1x @ ₹70, 1x @ ₹120, 1x @ ₹50',
      '',
      '✨ 3 items (₹240)'
    ]
  },
  {
    title: '✅ Order Settled',
    timestamp: 'Apr 9, 2026, 05:45:00 PM',
    before: {
      orderId: '89443c21-415d-4054-b3e4-559aed616175',
      tableId: 'ff58c634-724a-45aa-8d59-d52066366f89',
      totalAmount: 240,
      paymentMethod: 'Cash'
    },
    after: [
      'Order: #75',
      'Table: Table 5',
      'Amount Paid: ₹240',
      'Payment Method: Cash',
      'Status: Completed',
      '',
      '✨ ₹240'
    ]
  },
  {
    title: '🪑 Table Assigned',
    timestamp: 'Apr 9, 2026, 05:30:00 PM',
    before: {
      tableId: 'ff58c634-724a-45aa-8d59-d52066366f89',
      tableNumber: 5,
      capacity: 4
    },
    after: [
      'Table: Table 5',
      'Capacity: 4 seats',
      'Status: In Use',
      '',
      '✨ Table 5'
    ]
  }
];

activities.forEach((activity, idx) => {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`ACTIVITY ${idx + 1}: ${activity.title}`);
  console.log(`${'─'.repeat(70)}`);

  // BEFORE
  console.log('\n❌ BEFORE (Raw IDs):');
  console.log(JSON.stringify(activity.before, null, 2));

  // AFTER
  console.log('\n✅ AFTER (User-Friendly):');
  activity.after.forEach(line => {
    console.log(`   ${line}`);
  });

  // UI Preview
  console.log('\n🎨 UI DISPLAY:');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log(`│ ${activity.title.padEnd(42)} ${activity.timestamp.slice(-20).padStart(19)} │`);
  console.log('├─────────────────────────────────────────────────────────────┤');
  activity.after.forEach(line => {
    if (line.startsWith('✨')) {
      console.log(`│                                                             │`);
      console.log(`│  ${line.padEnd(59)} │`);
    } else if (line === '') {
      console.log('│                                                             │');
    } else {
      console.log(`│  ${line.padEnd(59)} │`);
    }
  });
  console.log('└─────────────────────────────────────────────────────────────┘');
});

console.log('\n' + '='.repeat(70));
console.log('✅ All activities formatted for better readability!');
console.log('='.repeat(70) + '\n');

console.log('🎯 KEY IMPROVEMENTS:');
console.log('   ✓ No more raw UUIDs - shows "#75" instead of 89443c21...');
console.log('   ✓ Table numbers instead of IDs - "Table 5" not ff58c634...');
console.log('   ✓ Labeled fields (Order:, Table:, Items:, etc)');
console.log('   ✓ Formatted currency with ₹ symbol');
console.log('   ✓ Key metrics highlighted with ✨');
console.log('   ✓ Item details shown as readable list');
console.log('   ✓ Consistent formatting across all activity types\n');

