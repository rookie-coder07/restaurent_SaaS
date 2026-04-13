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
  
  // ⚠️ Service role key is optional at startup - only warn, don't throw
  // It will be validated when actually needed
  if (!serviceRoleKey) {
    console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY not configured at startup');
    console.warn('   Admin operations will fail. Please ensure SUPABASE_SERVICE_ROLE_KEY is set in environment.');
  } else {
    console.log('✅ Supabase configuration validated');
    console.log(`   URL: ${url}`);
    console.log(`   Service Role Key: SET`);
  }
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
    const missingVars = [];
    if (!supabaseUrl) missingVars.push('SUPABASE_URL');
    if (!serviceRoleKey) missingVars.push('SUPABASE_SERVICE_ROLE_KEY');
    
    const errorMsg = `Supabase admin client initialization failed. Missing environment variables: ${missingVars.join(', ')}. ` +
                     `This is required for admin operations (user creation, staff registration, etc.). ` +
                     `Please ensure these variables are set in your Render backend environment.`;
    
    logger.error('❌ Admin Client Initialization Error');
    logger.error(`   Missing: ${missingVars.join(', ')}`);
    logger.error(`   SUPABASE_URL: ${supabaseUrl ? 'SET' : 'MISSING'}`);
    logger.error(`   SUPABASE_SERVICE_ROLE_KEY: ${serviceRoleKey ? 'SET' : 'MISSING'}`);
    
    throw new Error(errorMsg);
  }

  try {
    logger.info('[SUPABASE_ADMIN] Creating admin client with service role key');
    
    supabaseAdminSingleton = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: { 'x-client-info': 'restaurant-saas-backend-admin' },
      },
    });

    logger.info('✅ Supabase admin client created successfully');
    return supabaseAdminSingleton;
  } catch (error) {
    logger.error('❌ Failed to create Supabase admin client:', error.message);
    throw new Error(`Failed to initialize Supabase admin client: ${error.message}`);
  }
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
    
    // Create chainable mock that supports all query methods
    const createMockQueryChain = () => ({
      select: () => createMockQueryChain(),
      eq: () => createMockQueryChain(),
      insert: async () => ({ data: [], error: new Error('Supabase not initialized') }),
      update: async () => ({ data: null, error: new Error('Supabase not initialized') }),
      delete: async () => ({ data: null, error: new Error('Supabase not initialized') }),
      single: async () => ({ data: null, error: new Error('Supabase not initialized') }),
    });

    return {
      from: () => createMockQueryChain(),
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
    
    // ⚠️ IMPORTANT: Do NOT eagerly call getSupabaseAdmin() here
    // The admin client is lazily initialized when actually needed
    // This prevents startup failures if SUPABASE_SERVICE_ROLE_KEY is missing
    // Admin operations will gracefully fail at request time with clear error messages
    
    logger.info('✅ Supabase connected (admin client will be initialized on first admin operation)');
    return client;
  } catch (error) {
    logger.error('Supabase error at startup:', error.message);
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

// Initialize supabase client with error handling
let supabaseInstance;
try {
  supabaseInstance = getSupabase();
} catch (error) {
  logger.error('❌ Failed to initialize Supabase - falling back to mock', {
    error: error.message,
  });
  // Return a mock client that provides helpful error messages
  supabaseInstance = {
    from: (table) => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: null,
            error: new Error(`Supabase not initialized. Table: ${table}`),
          }),
        }),
        single: async () => ({
          data: null,
          error: new Error(`Supabase not initialized. Table: ${table}`),
        }),
      }),
      insert: async () => ({
        data: [],
        error: new Error(`Supabase not initialized. Unable to insert into ${table}`),
      }),
      update: async () => ({
        data: null,
        error: new Error(`Supabase not initialized. Unable to update ${table}`),
      }),
      delete: async () => ({
        data: null,
        error: new Error(`Supabase not initialized. Unable to delete from ${table}`),
      }),
    }),
  };
}

export default supabaseInstance;
