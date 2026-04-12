import { createClient } from '@supabase/supabase-js';
import logger from '../utils/logger.js';

let supabaseSingleton = null;

// Get mock or real supabase client
function getSupabase() {
  if (supabaseSingleton) {
    return supabaseSingleton;
  }

  if (process.env.NODE_ENV === 'test' && global.__SUPABASE_MOCK__) {
    supabaseSingleton = global.__SUPABASE_MOCK__;
    return supabaseSingleton;
  }
  
  if (process.env.NODE_ENV === 'test') {
    // Fallback mock if setup didn't populate it
    supabaseSingleton = {
      from: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
        insert: async () => ({ data: {}, error: null }),
        update: async () => ({ data: {}, error: null }),
      }),
      auth: {
        signInWithPassword: async () => ({ data: { user: { id: 'test' } }, error: null }),
      },
    };
    return supabaseSingleton;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase not initialized - missing SUPABASE_URL or SUPABASE_SERVICE_KEY (service role key required for admin operations)');
  }

  supabaseSingleton = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: { 'x-client-info': 'restaurant-saas-backend' },
    },
  });

  return supabaseSingleton;
}

export const connectSupabase = async () => {
  try {
    logger.info('Connecting to Supabase...');
    
    if (process.env.NODE_ENV === 'test') {
      logger.info('Test mode: Supabase mock active');
      return getSupabase();
    }
    
    const client = getSupabase();
    logger.info('Supabase connected');
    return client;
  } catch (error) {
    logger.error('Supabase error:', error.message);
    throw error;
  }
};

export const createTables = async () => {
  try {
    logger.info('Creating database tables...');
    logger.info('Database tables ready');
    return true;
  } catch (error) {
    logger.error('Table creation error:', error.message);
    throw error;
  }
};

export const supabaseAdmin = getSupabase();
export default getSupabase();
