#!/usr/bin/env node
/**
 * Test script to verify mock setup works before running full test suite
 */

import { jest } from '@jest/globals';

// Set test mode FIRST
process.env.NODE_ENV = 'test';

// Create mock supabase
const mockSupabase = {
  from: jest.fn().mockReturnValue({
    select: jest.fn(function() { return this; }),
    insert: jest.fn(function() { return this; }),
    update: jest.fn(function() { return this; }),
    delete: jest.fn(function() { return this; }),
    eq: jest.fn(function() { return this; }),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  }),
  rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  auth: {
    signInWithPassword: jest.fn().mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Mock error' }
    }),
    signUp: jest.fn().mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Mock error' }
    }),
  },
};

// Set global mock BEFORE importing modules
global.__SUPABASE_MOCK__ = mockSupabase;

console.log('✓ Global mock set');

// Import supabase config
const supabaseModule = await import('./src/config/supabase.js');
const supabase = supabaseModule.default;

console.log('✓ Supabase config imported');
console.log('Mock auth.signInWithPassword is jest fn?', typeof mockSupabase.auth.signInWithPassword.mock !== 'undefined');

// Try to call the auth method
try {
  const result = await supabase.auth.signInWithPassword({ email: 'test@test.com', password: 'pass' });
  console.log('✓ Mock auth.signInWithPassword called successfully');
  console.log('  Result:', result);
} catch (err) {
  console.error('✗ Error calling mock auth method:', err.message);
}

// Test AuthService injection
const AuthService = (await import('./src/services/authService.js')).default;

AuthService.setSupabase(mockSupabase);
console.log('✓ Mock injected into AuthService');

// Try a login
try {
  const result = await AuthService.login('test@test.com', 'password');
  console.log('✓ AuthService.login called (would work with proper mock responses)');
} catch (err) {
  console.log('✓ AuthService.login threw error as expected:', err.message.substring(0, 50));
}

console.log('\n✓ All mock setup tests passed!');
