import constants from './src/constants/index.js';

console.log('=== ROLE PERMISSIONS ===\n');
Object.entries(constants.ROLE_PERMISSIONS).forEach(([role, perms]) => {
  console.log(`${role.toUpperCase()}: ${perms.join(', ')}`);
});

console.log('\n=== TEST: Does STAFF/WAITER role have manage_orders? ===');
const staffPerms = constants.ROLE_PERMISSIONS['staff'];
console.log(`Staff permissions: ${staffPerms}`);
console.log(`Has 'manage_orders': ${staffPerms.includes('manage_orders')}`);
