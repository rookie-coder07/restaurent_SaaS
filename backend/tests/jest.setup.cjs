// GLOBAL FETCH MOCK - Smart mock that returns responses for Supabase-like requests
const originalFetch = global.fetch;
global.fetch = (url, options) => {
  const urlStr = url?.toString?.() || url || '';
  
  // Return mock responses for known Supabase patterns
  if (urlStr.includes('supabase') || urlStr.includes('test.supabase.co')) {
    // Return empty successful responses for all Supabase calls
    return Promise.resolve({
      status: 200,
      ok: true,
      json: () => Promise.resolve({
        data: null,
        error: null,
      }),
      text: () => Promise.resolve(JSON.stringify({ data: null, error: null })),
      headers: new Map(),
    });
  }
  
  // For any other URLs, reject
  return Promise.reject(new TypeError(`fetch failed for ${urlStr}`));
};

// ENVIRONMENT SETUP
process.env.NODE_ENV = 'test';
process.env.API_VERSION = 'v1';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
process.env.CLOUDINARY_API_KEY = 'test-api-key';
process.env.CLOUDINARY_API_SECRET = 'test-api-secret';
process.env.CORS_ORIGIN = 'https://restaurentsaas-seven.vercel.app';
process.env.AUTH_REDIRECT_URL = 'https://restaurentsaas-seven.vercel.app/auth/callback';

// CENTRALIZED SUPABASE MOCK FOR TESTING
const fixtures = {
  restaurants: [
    { 
      id: 'user-1',  // Match auth user ID for owner tests
      name: 'Owner Resto', 
      email: 'owner@example.com', 
      status: 'active', 
      timezone: 'Asia/Kolkata', 
      access_enabled: true,
      enable_gst: true,
      default_gst_percent: 5,
      phone: '9999999999',
      city: 'Mumbai',
      address: '123 Main St',
      gst_number: 'GST123'
    },
    { 
      id: 'rest-1', 
      name: 'Test Resto', 
      email: 'rest@example.com', 
      status: 'active', 
      timezone: 'Asia/Kolkata', 
      access_enabled: true,
      enable_gst: true,
      default_gst_percent: 5,
      phone: '9999999998',
      city: 'Mumbai',
      address: '456 Main St',
      gst_number: 'GST456'
    },
  ],
  users: [
    { id: 'user-1', restaurant_id: 'user-1', name: 'Owner', email: 'owner@example.com', role: 'owner', status: 'active', phone_number: '9999999999', password_hash: '', created_at: '2026-04-01T00:00:00Z' },
    { id: 'manager-1', restaurant_id: 'rest-1', name: 'Manager', email: 'manager@example.com', role: 'manager', status: 'active', phone_number: '9999999998', password_hash: '', created_at: '2026-04-01T00:00:00Z' },
    { id: 'developer-1', restaurant_id: null, name: 'Dev', email: 'dev@example.com', role: 'developer', status: 'active', phone_number: '', password_hash: '', created_at: '2026-04-01T00:00:00Z' },
  ],
  orders: [
    { 
      id: 'order-1', 
      restaurant_id: 'rest-1', 
      invoice_number: null, 
      payment_status: 'pending', 
      total_amount: 100, 
      status: 'pending', 
      table_id: 'table-1', 
      order_items: [], 
      created_at: '2026-04-05T08:00:00Z', 
      updated_at: '2026-04-05T08:00:00Z', 
      payment_method: 'cash', 
      order_type: 'dine-in', 
      notes: ''
    },
  ],
  activity_logs: [],
  tables: [
    { id: 'table-1', restaurant_id: 'rest-1', number: 1, status: 'available', created_at: '2026-04-01T00:00:00Z' },
  ],
};

function filterRows(table, state = {}) {
  let rows = [...(fixtures[table] || [])];
  
  if (state.filters && state.filters.length) {
    rows = rows.filter((row) =>
      state.filters.every((f) => {
        const rowVal = row[f.col];
        const filterVal = f.val;
        if (f.op === 'eq') return String(rowVal) === String(filterVal);
        if (f.op === 'neq') return String(rowVal) !== String(filterVal);
        if (f.op === 'in') return Array.isArray(filterVal) && filterVal.some(v => String(rowVal) === String(v));
        if (f.op === 'gte') return Number(rowVal) >= Number(filterVal);
        if (f.op === 'lte') return Number(rowVal) <= Number(filterVal);
        return String(rowVal) === String(filterVal);
      })
    );
  }

  if (state.order) {
    const [col, direction] = Array.isArray(state.order) ? state.order : [state.order, 'asc'];
    rows.sort((a, b) => {
      const aVal = a[col];
      const bVal = b[col];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return direction === 'desc' ? bVal - aVal : aVal - bVal;
      }
      const cmp = String(aVal || '').localeCompare(String(bVal || ''));
      return direction === 'desc' ? -cmp : cmp;
    });
  }

  if (state.limit && state.limit > 0) {
    rows = rows.slice(0, state.limit);
  }

  return rows;
}

const makeChain = (table, state = {}) => {
  const chain = {
    select: (cols, opts = {}) => {
      state.select = { cols, opts };
      return makeChain(table, state);
    },
    insert: (rows) => {
      const arr = Array.isArray(rows) ? rows : [rows];
      const newRows = arr.map(r => ({ ...r }));
      if (!fixtures[table]) fixtures[table] = [];
      fixtures[table].push(...newRows);
      return Promise.resolve({ data: newRows, error: null });
    },
    update: (payload) => {
      const rows = filterRows(table, state);
      rows.forEach(r => Object.assign(r, payload));
      return Promise.resolve({ data: rows, error: null });
    },
    delete: () => {
      const rows = filterRows(table, state);
      if (rows.length && fixtures[table]) {
        fixtures[table] = fixtures[table].filter(r => !rows.includes(r));
      }
      return Promise.resolve({ data: rows, error: null });
    },
    upsert: (rows) => {
      const arr = Array.isArray(rows) ? rows : [rows];
      if (!fixtures[table]) fixtures[table] = [];
      fixtures[table].push(...arr);
      return Promise.resolve({ data: arr, error: null });
    },
    eq: (col, val) => makeChain(table, { ...state, filters: [...(state.filters || []), { col, val, op: 'eq' }] }),
    neq: (col, val) => makeChain(table, { ...state, filters: [...(state.filters || []), { col, val, op: 'neq' }] }),
    in: (col, vals) => makeChain(table, { ...state, filters: [...(state.filters || []), { col, val: vals, op: 'in' }] }),
    gte: (col, val) => makeChain(table, { ...state, filters: [...(state.filters || []), { col, val, op: 'gte' }] }),
    lte: (col, val) => makeChain(table, { ...state, filters: [...(state.filters || []), { col, val, op: 'lte' }] }),
    order: (col, opts = {}) => makeChain(table, { ...state, order: [col, opts.ascending === false ? 'desc' : 'asc'] }),
    limit: (n) => makeChain(table, { ...state, limit: n }),
    range: (start, end) => makeChain(table, { ...state, range: { start, end } }),
    single: async () => {
      const rows = filterRows(table, state);
      const data = rows[0] || null;
      return Promise.resolve({ data, error: rows.length > 1 ? { message: 'Multiple rows found' } : null, count: rows.length });
    },
    maybeSingle: async () => {
      const rows = filterRows(table, state);
      return Promise.resolve({ data: rows[0] || null, error: null, count: rows.length });
    },
    throwOnError: () => chain,
    or: (filters, opts) => makeChain(table, state),
    then: undefined,
  };
  return chain;
};

const mockSupabase = {
  from: (table) => {
    if (!table) throw new Error('Table name required');
    return makeChain(table);
  },
  auth: {
    signInWithPassword: async ({ email, password }) => {
      const user = fixtures.users.find(u => String(u.email).toLowerCase() === String(email || '').toLowerCase());
      if (user) {
        return {
          data: {
            user: { id: user.id, email: user.email, user_metadata: { name: user.name, role: user.role } },
            session: { access_token: 'test-token-' + user.id },
          },
          error: null,
        };
      }
      return { data: null, error: { message: 'Invalid credentials' } };
    },
    signUp: async ({ email, password, options = {} }) => {
      const userId = 'user-' + Date.now();
      return {
        data: { 
          user: { 
            id: userId, 
            email: String(email || '').toLowerCase(),
            user_metadata: options.data || {}
          }, 
          session: { access_token: 'test-token-' + userId } 
        },
        error: null,
      };
    },
    signOut: async () => ({ error: null }),
    signInWithOtp: async ({ email }) => ({ data: null, error: null }),
    verifyOtp: async ({ email, token, type }) => ({
      data: { user: fixtures.users[0], session: { access_token: 'test-token' } },
      error: null,
    }),
    getUser: async () => ({ data: { user: fixtures.users[0] }, error: null }),
    getSession: async () => ({ data: { session: { access_token: 'test-token' } }, error: null }),
    refreshSession: async () => ({ data: { session: { access_token: 'test-token-refreshed' } }, error: null }),
    admin: {
      getUserById: async (id) => {
        const user = fixtures.users.find(u => u.id === id);
        return { data: { user: user || { id } }, error: null };
      },
      listUsers: async () => ({
        data: { users: fixtures.users },
        error: null,
      }),
      updateUserById: async (id, attrs) => ({
        data: { user: { id, ...attrs } },
        error: null,
      }),
      deleteUser: async (id) => ({ error: null }),
      createUser: async (attrs) => ({
        data: { user: { id: 'user-' + Date.now(), ...attrs } },
        error: null,
      }),
    },
  },
  storage: {
    from: () => makeChain('storage'),
  },
  rpc: async (fn, params) => ({ data: null, error: null }),
};

// Mock @supabase/supabase-js BEFORE any service imports
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

// Also set in global so config/supabase.js can access it
global.__SUPABASE_MOCK__ = mockSupabase;

module.exports = { mockSupabase, fixtures };
