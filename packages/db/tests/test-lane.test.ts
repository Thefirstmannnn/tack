import { afterEach, describe, expect, it } from 'bun:test';
import { laneDatabase, laneSuffix, resolveTestDatabaseUrl } from '../../../scripts/test-env.ts';

const saved = {
  lane: process.env['TACK_TEST_LANE'],
  database: process.env['DATABASE_URL'],
  explicit: process.env['TEST_DATABASE_URL'],
};

type EnvKey = 'TACK_TEST_LANE' | 'DATABASE_URL' | 'TEST_DATABASE_URL';

function restore(key: EnvKey, value?: string) {
  if (value === undefined) Reflect.deleteProperty(process.env, key);
  else process.env[key] = value;
}

function clear(key: EnvKey) {
  Reflect.deleteProperty(process.env, key);
}

afterEach(() => {
  restore('TACK_TEST_LANE', saved.lane);
  restore('DATABASE_URL', saved.database);
  restore('TEST_DATABASE_URL', saved.explicit);
});

describe('laneSuffix', () => {
  it('is empty when no lane is asked for', () => {
    expect(laneSuffix(undefined)).toBe('');
    expect(laneSuffix('')).toBe('');
  });

  it('reduces a lane to characters a database name allows', () => {
    expect(laneSuffix('Agent-7')).toMatch(/^agent7[0-9a-f]{8}$/);
  });

  it('is stable, so every package in one run lands in the same lane', () => {
    expect(laneSuffix('agent-7')).toBe(laneSuffix('agent-7'));
  });

  it('keeps two lanes apart even when normalising makes them look alike', () => {
    expect(laneSuffix('agent-7')).not.toBe(laneSuffix('agent_7'));
    expect(laneSuffix('wf/1')).not.toBe(laneSuffix('wf-1'));
    expect(laneSuffix('Alpha')).not.toBe(laneSuffix('alpha'));
  });

  it('still yields a usable lane when nothing readable survives', () => {
    expect(laneSuffix('---')).toMatch(/^[0-9a-f]{8}$/);
    expect(laneSuffix('---')).not.toBe(laneSuffix('___'));
  });

  it('caps the length so the database name stays well inside the Postgres limit', () => {
    const longest = `tack_test_core_${laneSuffix('a'.repeat(200))}`;
    expect(laneSuffix('a'.repeat(200))).toHaveLength(20);
    expect(longest.length).toBeLessThan(63);
  });
});

describe('laneDatabase', () => {
  it('leaves the base alone without a lane', () => {
    expect(laneDatabase('tack_test_core', '')).toBe('tack_test_core');
  });

  it('suffixes the base with the lane', () => {
    expect(laneDatabase('tack_test_core', 'alpha')).toBe('tack_test_core_alpha');
  });
});

describe('resolveTestDatabaseUrl', () => {
  it('keeps the base database when no lane is set', () => {
    clear('TACK_TEST_LANE');
    clear('TEST_DATABASE_URL');
    process.env['DATABASE_URL'] = 'postgres://tack:tack@localhost:5434/tack';

    expect(resolveTestDatabaseUrl('tack_test_core')).toContain('/tack_test_core');
  });

  it('gives each lane its own database', () => {
    clear('TEST_DATABASE_URL');
    process.env['DATABASE_URL'] = 'postgres://tack:tack@localhost:5434/tack';

    process.env['TACK_TEST_LANE'] = 'alpha';
    const alpha = resolveTestDatabaseUrl('tack_test_core');
    process.env['TACK_TEST_LANE'] = 'beta';
    const beta = resolveTestDatabaseUrl('tack_test_core');

    expect(alpha).toContain('/tack_test_core_alpha');
    expect(beta).toContain('/tack_test_core_beta');
    expect(alpha).not.toBe(beta);
  });

  it('keeps two packages apart inside one lane', () => {
    clear('TEST_DATABASE_URL');
    process.env['DATABASE_URL'] = 'postgres://tack:tack@localhost:5434/tack';
    process.env['TACK_TEST_LANE'] = 'alpha';

    expect(resolveTestDatabaseUrl('tack_test_core')).not.toBe(
      resolveTestDatabaseUrl('tack_test_svc'),
    );
  });

  it('honours an ambient test database only when no lane is asked for', () => {
    clear('TEST_DATABASE_URL');
    process.env['DATABASE_URL'] = 'postgres://tack:tack@localhost:5434/tack_test_core';

    clear('TACK_TEST_LANE');
    expect(resolveTestDatabaseUrl('tack_test_core')).toContain('/tack_test_core');

    process.env['TACK_TEST_LANE'] = 'alpha';
    expect(resolveTestDatabaseUrl('tack_test_core')).toContain('/tack_test_core_alpha');
  });

  it('lets an explicit TEST_DATABASE_URL win outright', () => {
    process.env['TACK_TEST_LANE'] = 'alpha';
    process.env['TEST_DATABASE_URL'] = 'postgres://tack:tack@localhost:5434/tack_test_web';

    expect(resolveTestDatabaseUrl('tack_test_core')).toContain('/tack_test_web');
  });

  it('still refuses a database that does not look like a test database', () => {
    process.env['TACK_TEST_LANE'] = 'alpha';
    process.env['TEST_DATABASE_URL'] = 'postgres://tack:tack@localhost:5434/tack';

    expect(() => resolveTestDatabaseUrl('tack_test_core')).toThrow();
  });
});
