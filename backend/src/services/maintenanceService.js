import supabase from '../config/supabase.js';
import logger from '../utils/logger.js';

class MaintenanceService {
  static initialized = false;
  static maintenanceInterval = null;

  static init() {
    if (this.initialized) return;
    this.initialized = true;

    // Schedule cleanup daily at 2 AM
    const scheduleNextCleanup = () => {
      const now = new Date();
      const cleanupTime = new Date();
      cleanupTime.setHours(2, 0, 0, 0);
      
      if (now > cleanupTime) {
        cleanupTime.setDate(cleanupTime.getDate() + 1);
      }
      
      const msUntilCleanup = cleanupTime.getTime() - now.getTime();
      
      this.maintenanceInterval = setTimeout(async () => {
        logger.info('🧹 Starting daily maintenance jobs...');
        try {
          await Promise.all([
            this.archiveOldCompletedOrders(),
            this.cleanOldAuthLogs(),
          ]);
          logger.info('✅ Daily maintenance jobs completed');
        } catch (error) {
          logger.error('❌ Maintenance jobs failed:', error);
        }
        
        scheduleNextCleanup();
      }, msUntilCleanup);
    };

    scheduleNextCleanup();
    logger.info('🔧 Maintenance service initialized');
  }

  // Archive old completed/cancelled orders (older than 90 days) to reduce query load
  static async archiveOldCompletedOrders() {
    try {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

      const { count, error } = await supabase
        .from('orders')
        .update({ is_archived: true })
        .lt('created_at', ninetyDaysAgo)
        .in('status', ['completed', 'cancelled'])
        .eq('is_archived', false);

      if (error && error.code !== 'PGRST204') throw error;
      logger.info(`📦 Archived ${count || 0} old orders`);
    } catch (error) {
      logger.error('Error archiving old orders:', error);
    }
  }

  // Remove auth logs older than 60 days
  static async cleanOldAuthLogs() {
    try {
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

      const { count, error } = await supabase
        .from('auth_logs')
        .delete()
        .lt('created_at', sixtyDaysAgo);

      if (error && error.code !== 'PGRST204') throw error;
      logger.info(`🔐 Cleaned ${count || 0} auth logs`);
    } catch (error) {
      logger.error('Error cleaning auth logs:', error);
    }
  }

  // Manual trigger for immediate cleanup (for testing/admin use)
  static async triggerNow() {
    logger.info('🚀 Manual maintenance trigger');
    return Promise.all([
      this.archiveOldCompletedOrders(),
      this.cleanOldAuthLogs(),
    ]);
  }

  // Stop scheduled maintenance (useful for graceful shutdown)
  static stop() {
    if (this.maintenanceInterval) {
      clearTimeout(this.maintenanceInterval);
      logger.info('🛑 Maintenance service stopped');
    }
  }
}

export default MaintenanceService;
