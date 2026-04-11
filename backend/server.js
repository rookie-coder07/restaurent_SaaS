import 'dotenv/config';
import logger from './src/utils/logger.js';
import { validateEnvironment, getConfig } from './src/config/environment.js';
import { connectSupabase } from './src/config/supabase.js';
import { monitoringService } from './src/services/monitoringService.js';
import app from './src/app.js';

const startServer = async () => {
  try {
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('🚀 BACKEND INITIALIZATION STARTED');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Validate environment variables
    validateEnvironment();
    logger.info('✅ All required environment variables are set');

    const config = getConfig();
    const PORT = process.env.PORT || process.env.APP_PORT || config.port || 5000;

    // Connect to Supabase
    logger.info('📦 Connecting to Supabase PostgreSQL...');
    let supabase = null;
    
    // Attempt to connect but don't block server startup
    connectSupabase()
      .then(() => {
        logger.info('✅ DATABASE CONNECTED SUCCESSFULLY');
      })
      .catch((dbError) => {
        logger.warn('⚠️  DATABASE CONNECTION FAILED (will retry)');
        logger.warn(`   Error: ${dbError.message}`);
        
        // Retry connection every 30 seconds
        setInterval(async () => {
          try {
            await connectSupabase();
            logger.info('✅ DATABASE RECONNECTED SUCCESSFULLY');
          } catch (retryError) {
            logger.warn('⚠️  Database reconnection still failing:', retryError.message);
          }
        }, 30000);
      });

    // Start server immediately
    const server = app.listen(PORT, () => {
      logger.info('');
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.info('✅ BACKEND HTTP SERVER STARTED');
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.info('');
      logger.info(`🌍 Environment: ${config.nodeEnv || 'development'}`);
      logger.info(`🎯 Server URL: http://localhost:${PORT}`);
      logger.info(`📊 API Base: http://localhost:${PORT}/api`);
      logger.info(`📝 API Version: ${config.apiVersion || 'v1'}`);
      logger.info('');
      logger.info('📌 Key Endpoints:');
      logger.info(`   - GET    http://localhost:${PORT}/health (Health Check)`);
      logger.info(`   - GET    http://localhost:${PORT}/api/v1/health/health (API Health Check)`);
      logger.info(`   - GET    http://localhost:${PORT}/api/v1/health/metrics (Metrics)`);
      logger.info(`   - GET    http://localhost:${PORT}/api/v1/health/alerts (Alerts)`);
      logger.info(`   - POST   http://localhost:${PORT}/api/v1/auth/register (Register)`);
      logger.info(`   - POST   http://localhost:${PORT}/api/v1/auth/login (Login)`);
      logger.info(`   - GET    http://localhost:${PORT}/api/v1/menu (Get Menu)`);
      logger.info(`   - POST   http://localhost:${PORT}/api/v1/orders (Create Order)`);
      logger.info(`   - GET    http://localhost:${PORT}/api/v1/kitchen (Kitchen Queue)`);
      logger.info('');
      logger.info(`☁️  Cloudinary: ✅ Configured`);
      logger.info(`🔐 Authentication: ✅ JWT + Cookies`);
      logger.info(`📊 Monitoring: ✅ Active`);
      logger.info('');

      // Start monitoring service
      monitoringService.start();
      logger.info('✅ Monitoring service enabled');

      logger.info('');
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.info('🎯 Ready to handle requests!');
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });

    // Graceful shutdown
    const gracefulShutdown = (signal) => {
      logger.warn('');
      logger.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.warn(`⏹️  ${signal} signal received`);
      logger.warn('🛑 BACKEND SHUTDOWN IN PROGRESS');
      logger.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // Stop monitoring service
      monitoringService.stop();
      logger.info('✅ Monitoring service stopped');

      server.close(() => {
        logger.info('✅ HTTP server closed gracefully');
        logger.info('👋 BACKEND DISCONNECTED');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('❌ Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Unhandled promise rejection
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('');
      logger.error('❌ UNHANDLED REJECTION DETECTED');
      logger.error(`💥 Promise: ${promise}`);
      logger.error(`📝 Reason: ${reason}`);
      logger.error('');
    });

    // Uncaught exception
    process.on('uncaughtException', (error) => {
      logger.error('');
      logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.error('❌ CRITICAL ERROR - UNCAUGHT EXCEPTION');
      logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.error(`📝 Error: ${error.message}`);
      logger.error(`🔍 Stack: ${error.stack}`);
      logger.error('🛑 SHUTTING DOWN BACKEND');
      logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      process.exit(1);
    });
  } catch (error) {
    logger.error('');
    logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.error('❌ FAILED TO START BACKEND');
    logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.error(`📝 Error: ${error.message}`);
    logger.error(`🔍 Stack: ${error.stack}`);
    logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    process.exit(1);
  }
};

startServer();
