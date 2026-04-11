// Quick test to verify kitchen orders are flattening correctly
import OrderService from './src/services/orderService.js';
import { getSupabase } from './src/config/supabase.js';
import logger from './src/utils/logger.js';

async function testKitchenOrders() {
  try {
    // Get some actual orders
    const restaurantId = 'test-restaurant-id'; // Replace with real ID
    
    logger.info('Testing kitchen orders flattening...');
    const tickets = await OrderService.getKitchenOrders(restaurantId);
    
    logger.info(`Response type: ${Array.isArray(tickets) ? 'Array' : typeof tickets}`);
    logger.info(`Number of items: ${Array.isArray(tickets) ? tickets.length : 'N/A'}`);
    
    if (Array.isArray(tickets) && tickets.length > 0) {
      const sample = tickets[0];
      logger.info('First ticket structure:', {
        id: sample.id,
        orderId: sample.orderId,
        status: sample.status,
        keys: Object.keys(sample).slice(0, 10),
      });
      
      const missingOrderId = tickets.filter(t => !t.orderId);
      if (missingOrderId.length > 0) {
        logger.error(`❌ PROBLEM: ${missingOrderId.length}/${tickets.length} tickets missing orderId!`);
        logger.info('Example ticket without orderId:', JSON.stringify(missingOrderId[0], null, 2).substring(0, 500));
      } else {
        logger.info(`✅ SUCCESS: All ${tickets.length} tickets have orderId`);
      }
    } else {
      logger.info('No tickets returned (empty or null response)');
    }
  } catch (error) {
    logger.error('Test failed:', error);
  }
}

testKitchenOrders().then(() => process.exit(0));
