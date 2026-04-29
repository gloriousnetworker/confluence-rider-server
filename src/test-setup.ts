// Test setup — sets NODE_ENV before env.ts loads
process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/confluence_ride_test";
process.env.JWT_SECRET =
  "test-secret-key-that-is-at-least-32-characters-long";
process.env.CORS_ORIGIN = "http://localhost:5173";
