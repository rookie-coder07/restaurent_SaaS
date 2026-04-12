import { createClient } from '@supabase/supabase-js';
import logger from '../utils/logger.js';

let supabaseSingleton = null;
let supabaseAdminSingleton = null;

// Validate environment variables at startup
export const validateSupabaseConfig = () => {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url) {
    throw new Error('SUPABASE_URL not configured');
  }
  
  if (!serviceRoleKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY is missing!');
    console.error('Admin operations will fail. Please set SUPABASE_SERVICE_ROLE_KEY in environment variables.');
    throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured - required for admin operations');
  }
  
  console.log('✅ Supabase configuration validated');
  console.log(`   URL: ${url}`);
  console.log(`   Service Role Key: ${serviceRoleKey ? 'SET' : 'MISSING'}`);
};

// Get admin client (uses service role key for admin operations)
export function getSupabaseAdmin() {
  if (supabaseAdminSingleton) {
    return supabaseAdminSingleton;
  }

  if (process.env.NODE_ENV === 'test' && global.__SUPABASE_MOCK__) {
    supabaseAdminSingleton = global.__SUPABASE_MOCK__;
    return supabaseAdminSingleton;
  }
  
  if (process.env.NODE_ENV === 'test') {
    supabaseAdminSingleton = {
      from: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
        insert: async () => ({ data: {}, error: null }),
        update: async () => ({ data: {}, error: null }),
      }),
      auth: {
        admin: {
          createUser: async () => ({ data: { user: { id: 'test-user-123' } }, error: null }),
          updateUserById: async () => ({ data: { user: {} }, error: null }),
          deleteUser: async () => ({ data: {}, error: null }),
        },
        signInWithPassword: async () => ({ data: { user: { id: 'test' } }, error: null }),
      },
    };
    return supabaseAdminSingleton;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase admin client not initialized - missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  console.log('[SUPABASE_ADMIN] Creating admin client with service role key');
  
  supabaseAdminSingleton = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: { 'x-client-info': 'restaurant-saas-backend-admin' },
    },
  });

  return supabaseAdminSingleton;
}

// Get regular client (uses anon key for user operations)
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
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    // Return null client that will fail at connectSupabase() validation time
    // This allows module loading to complete even if env vars aren't set yet
    logger.warn('Supabase configuration incomplete during module load - will validate at startup');
    return {
      from: () => ({ insert: async () => ({ error: new Error('Supabase not initialized') }) }),
      auth: { signInWithPassword: async () => ({ error: new Error('Supabase not initialized') }) },
    };
  }

  supabaseSingleton = createClient(supabaseUrl, anonKey, {
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
    // Validate configuration
    if (process.env.NODE_ENV !== 'test') {
      validateSupabaseConfig();
    }
    
    logger.info('Connecting to Supabase...');
    
    if (process.env.NODE_ENV === 'test') {
      logger.info('Test mode: Supabase mock active');
      return getSupabase();
    }
    
    const client = getSupabase();
    const adminClient = getSupabaseAdmin();
    logger.info('✅ Supabase connected with admin client');
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

export { getSupabase };
export default getSupabase();
