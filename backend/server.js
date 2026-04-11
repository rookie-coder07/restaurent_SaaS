import 'dotenv/config';
import logger from './src/utils/logger.js';
import { validateEnvironment, getConfig } from './src/config/environment.js';
import { connectSupabase } from './src/config/supabase.js';
import { monitoringService } from './src/services/monitoringService.js';
import app from './src/app.js';

const KEEP_ALIVE_INTERVAL_MS = 300000;
const KEEP_ALIVE_URL = 'https://restaurent-backend-448t.onrender.com/health';

const startServer = async () => {
  try {
    validateEnvironment();

    const config = getConfig();
    const PORT = process.env.PORT || process.env.APP_PORT || config.port || 5000;
    const isProd = process.env.NODE_ENV === 'production';
    const baseUrl = (process.env.BASE_URL || config.baseUrl || 'https://restaurent-backend-448t.onrender.com').replace(/\/+$/, '');
    const publicServerUrl = isProd ? baseUrl : `http://localhost:${PORT}`;
    const publicApiBaseUrl = isProd ? `${baseUrl}/api/v1` : `http://localhost:${PORT}/api/v1`;

    logger.info('BACKEND INITIALIZATION STARTED');
    logger.info(`Environment target: ${config.nodeEnv || 'development'}`);

    connectSupabase()
      .then(() => {
        logger.info('DATABASE CONNECTED SUCCESSFULLY');
      })
      .catch((dbError) => {
        logger.warn(`DATABASE CONNECTION FAILED: ${dbError.message}`);

        setInterval(async () => {
          try {
            await connectSupabase();
            logger.info('DATABASE RECONNECTED SUCCESSFULLY');
          } catch (retryError) {
            logger.warn(`Database reconnection still failing: ${retryError.message}`);
          }
        }, 30000);
      });

    const server = app.listen(PORT, () => {
      logger.info('BACKEND HTTP SERVER STARTED');
      logger.info(`✔ Environment: ${config.nodeEnv || 'development'}`);
      logger.info(`Server URL: ${publicServerUrl}`);
      logger.info(`✔ API Base: ${publicApiBaseUrl}`);
      logger.info(`API Version: ${config.apiVersion || 'v1'}`);
      logger.info(`✔ No localhost usage: ${String(!(isProd && baseUrl.includes('localhost')))}`);
      logger.info('✔ Health endpoint working: /health');

      monitoringService.start();
      logger.info('Monitoring service enabled');

      if (isProd) {
        logger.info('Production mode detected - starting keep-alive ping');
        setInterval(async () => {
          try {
            await fetch(KEEP_ALIVE_URL);
          } catch (err) {
            logger.error('Ping failed');
          }
        }, KEEP_ALIVE_INTERVAL_MS);
      }
    });

    const gracefulShutdown = (signal) => {
      logger.warn(`${signal} signal received`);
      monitoringService.stop();
      server.close(() => {
        logger.info('HTTP server closed gracefully');
        process.exit(0);
      });

      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('unhandledRejection', (reason) => {
      logger.error(`UNHANDLED REJECTION DETECTED: ${reason}`);
    });
    process.on('uncaughtException', (error) => {
      logger.error(`CRITICAL ERROR - UNCAUGHT EXCEPTION: ${error.message}`);
      process.exit(1);
    });
  } catch (error) {
    logger.error(`FAILED TO START BACKEND: ${error.message}`);
    process.exit(1);
  }
};

startServer();
