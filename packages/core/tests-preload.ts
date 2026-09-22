import { ensureLaneDatabase } from '@tack/db/test-lane';
import { resolveTestDatabaseUrl } from '../../scripts/test-env.ts';

const databaseUrl = resolveTestDatabaseUrl('tack_test_core');
await ensureLaneDatabase(databaseUrl, 'tack_test_core');
process.env['DATABASE_URL'] = databaseUrl;
process.env['TACK_TEST_REDIS_URL'] = process.env['REDIS_URL'] ?? '';
process.env['REDIS_URL'] = '';
process.env['DATABASE_POOL_MAX'] = '1';
