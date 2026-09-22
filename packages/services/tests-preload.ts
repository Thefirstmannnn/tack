import { ensureLaneDatabase } from '@tack/db/test-lane';
import { resolveTestDatabaseUrl } from '../../scripts/test-env.ts';

const databaseUrl = resolveTestDatabaseUrl('tack_test_svc');
await ensureLaneDatabase(databaseUrl, 'tack_test_svc');
process.env['DATABASE_URL'] = databaseUrl;
process.env['DATABASE_POOL_MAX'] = '2';
