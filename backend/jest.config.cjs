module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFiles: ['<rootDir>/tests/jest.setup.cjs'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/config/**',
  ],
  moduleNameMapper: {
    '^@supabase/supabase-js$': '<rootDir>/tests/supabase-mock.cjs',
  },
};
