import { defineConfig } from 'drizzle-kit';

const url = process.env['DATABASE_URL'] ?? 'postgres://tack:tack@localhost:5434/tack';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  casing: 'snake_case',
  dbCredentials: { url },
  verbose: true,
  strict: true,
});
