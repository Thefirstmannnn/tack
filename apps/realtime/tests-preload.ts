import { ensureLaneDatabase } from '@tack/db/test-lane';
import { resolveTestDatabaseUrl } from '../../scripts/test-env.ts';

const databaseUrl = resolveTestDatabaseUrl('tack_test_rt');
await ensureLaneDatabase(databaseUrl, 'tack_test_rt');
process.env['DATABASE_URL'] = databaseUrl;
process.env['REDIS_URL'] = process.env['REDIS_URL'] || 'redis://localhost:6380';
process.env['DATABASE_POOL_MAX'] = '2';
