import pg from 'pg';
import logger from '../utils/logger.js';

const { Pool } = pg;

let pool = null;

export const initializePool = () => {
  if (pool) {
    return pool;
  }

  try {
    const databaseUrl = process.env.SUPABASE_URL 
      ? `postgresql://postgres:${process.env.SUPABASE_SERVICE_ROLE_KEY}@${process.env.SUPABASE_URL.replace('https://', '')}/postgres`
      : process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL or SUPABASE configuration not found');
    }

    pool = new Pool({
      connectionString: databaseUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 30000,  // Increased from 2000ms to 30s for bulk operations
      statement_timeout: 30000,        // 30s statement timeout for long-running queries
    });

    pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', err);
    });

    logger.info('✅ PostgreSQL connection pool initialized');
    return pool;
  } catch (error) {
    logger.error('❌ Failed to initialize PostgreSQL pool:', error.message);
    throw error;
  }
};

export const getPool = () => {
  if (!pool) {
    return initializePool();
  }
  return pool;
};

export const query = async (text, params = []) => {
  const client = pool || initializePool();
  try {
    return await client.query(text, params);
  } catch (error) {
    // Provide more detailed error information for debugging
    const isTimeoutError = error.message.includes('timeout') || 
                          error.code === 'ECONNREFUSED' ||
                          error.code === 'ETIMEDOUT';
    
    logger.error('[DB_QUERY] Error executing query:', {
      query: text.substring(0, 100),
      error: error.message,
      code: error.code,
      isTimeoutError,
      params: params.length,
      poolSize: {
        totalCount: client.totalCount,
        idleCount: client.idleCount,
        waitingCount: client.waitingCount,
      },
    });
    throw error;
  }
};

export const closePool = async () => {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('PostgreSQL pool closed');
  }
};

export default {
  initializePool,
  getPool,
  query,
  closePool,
};
