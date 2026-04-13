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
      connectionTimeoutMillis: 2000,
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
    logger.error('[DB_QUERY] Error executing query:', {
      query: text.substring(0, 100),
      error: error.message,
      params: params.length,
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
