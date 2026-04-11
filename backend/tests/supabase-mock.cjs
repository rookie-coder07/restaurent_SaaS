// Mock Supabase client for testing
// This is imported via jest.config.cjs moduleNameMapper

const createMockChain = () => {
  const chain = {
    select: function() { return this; },
    insert: function() { return this; },
    update: function() { return this; },
    delete: function() { return this; },
    eq: function() { return this; },
    is: function() { return this; },
    order: function() { return this; },
    limit: function() { return this; },
    single: async () => ({ data: null, error: null }),
    maybeSingle: async () => ({ data: null, error: null }),
  };
  return chain;
};

const createMockAuth = () => ({
  signInWithPassword: async () => ({
    data: { user: null, session: null },
    error: null,
  }),
  signUp: async () => ({
    data: { user: null, session: null },
    error: null,
  }),
  signOut: async () => ({ error: null }),
  getUser: async () => ({
    data: { user: null },
    error: null,
  }),
  getSession: async () => ({
    data: { session: null },
    error: null,
  }),
  refreshSession: async () => ({
    data: { session: null },
    error: null,
  }),
  resetPasswordForEmail: async () => ({
    data: {},
    error: null,
  }),
  updateUser: async () => ({
    data: { user: null },
    error: null,
  }),
  admin: {
    createUser: async () => ({
      user: { id: 'user-123' },
    }),
    deleteUser: async () => ({ success: true }),
    listUsers: async () => ({ users: [] }),
  },
});

const mockSupabase = {
  from: () => createMockChain(),
  auth: createMockAuth(),
  storage: {
    from: () => ({
      upload: async () => ({ data: { path: 'test-path' } }),
      download: async () => ({ data: new Blob() }),
      remove: async () => ({ data: [{ name: 'test' }] }),
    }),
  },
  rpc: async () => ({ data: null, error: null }),
};

const createClient = () => mockSupabase;

module.exports = {
  createClient,
  SupabaseClient: function() {},
};
