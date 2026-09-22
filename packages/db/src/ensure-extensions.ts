import postgres from 'postgres';

const connectionString = process.env['DATABASE_URL'] ?? 'postgres://tack:tack@localhost:5434/tack';

const sql = postgres(connectionString);

await sql`create extension if not exists pg_trgm`;
await sql.end();
