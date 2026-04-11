import app from './app.js';
import logger from './utils/logger.js';
import { getConfig } from './config/environment.js';
import { connectSupabase } from './config/supabase.js';

const KEEP_ALIVE_INTERVAL_MS = 300000;
const KEEP_ALIVE_URL = 'https://restaurent-backend-448t.onrender.com/health';

const config = getConfig();
const PORT = config.port || 3000;
const isProd = config.isProd;
const baseUrl = (config.baseUrl || 'https://restaurent-backend-448t.onrender.com').replace(/\/+$/, '');
const publicServerUrl = isProd ? baseUrl : `http://localhost:${PORT}`;
const publicApiBaseUrl = isProd ? `${baseUrl}/api/v1` : `http://localhost:${PORT}/api/v1`;
const hasLocalhostExposure = /localhost|127\.0\.0\.1/i.test(publicServerUrl) || /localhost|127\.0\.0\.1/i.test(publicApiBaseUrl);

async function startServer() {
  try {
    await connectSupabase();
    logger.info('DATABASE CONNECTED SUCCESSFULLY');

    const server = app.listen(PORT, () => {
      logger.info(`Environment: ${config.nodeEnv || 'development'}`);
      logger.info(`Server URL: ${publicServerUrl}`);
      logger.info(`API Base: ${publicApiBaseUrl}`);
      logger.info(`No localhost usage: ${String(!hasLocalhostExposure)}`);
      logger.info('Health endpoint working: /health');

      if (isProd) {
        setInterval(async () => {
          try {
            await fetch(KEEP_ALIVE_URL);
          } catch (err) {
            logger.error('Ping failed');
          }
        }, KEEP_ALIVE_INTERVAL_MS);
      }
    });

    process.on('SIGTERM', () => {
      server.close(() => {
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      server.close(() => {
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error(`FAILED TO START BACKEND: ${error.message}`);
    process.exit(1);
  }
}

startServer();
