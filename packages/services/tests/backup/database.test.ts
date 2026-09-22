import { describe, expect, it } from 'bun:test';
import { DomainError } from '@tack/shared';
import { dumpDatabase, parseDatabaseConnection } from '../../src/backup/database.ts';

describe('parseDatabaseConnection', () => {
  it('parses standard connection url', () => {
    const parsed = parseDatabaseConnection(
      'postgres://tack_user:secret_pass@db.example.com:5433/tack_db',
    );
    expect(parsed.host).toBe('db.example.com');
    expect(parsed.port).toBe('5433');
    expect(parsed.user).toBe('tack_user');
    expect(parsed.password).toBe('secret_pass');
    expect(parsed.database).toBe('tack_db');
  });

  it('defaults port to 5432 when omitted', () => {
    const parsed = parseDatabaseConnection('postgres://tack_user@localhost/tack');
    expect(parsed.port).toBe('5432');
    expect(parsed.password).toBeUndefined();
  });

  it('handles percent-encoded credentials properly', () => {
    const parsed = parseDatabaseConnection(
      'postgres://user%40domain:p%40ss%23word@127.0.0.1:5432/my_db',
    );
    expect(parsed.user).toBe('user@domain');
    expect(parsed.password).toBe('p@ss#word');
    expect(parsed.database).toBe('my_db');
  });

  it('throws on invalid connection url', () => {
    expect(() => parseDatabaseConnection('postgres:///empty_host')).toThrow();
  });

  it('throws validationFailed on invalid connection url format', () => {
    try {
      parseDatabaseConnection('not-a-valid-url');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe('validation_failed');
    }
  });

  it('throws validationFailed on malformed percent-encoded credentials', () => {
    try {
      parseDatabaseConnection('postgres://invalid%FFuser@localhost:5432/tack');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe('validation_failed');
    }
  });

  it('preserves TLS and libpq parameters when URL is sanitized', () => {
    const rawUrl =
      'postgres://tack_user:secret_pass@db.example.com:5433/tack_db?sslmode=verify-full&sslrootcert=%2Fpath%2Froot.crt';
    const parsed = new URL(rawUrl);
    const password = parsed.password.length > 0 ? decodeURIComponent(parsed.password) : undefined;
    parsed.password = '';
    const sanitizedUrl = parsed.toString();

    expect(password).toBe('secret_pass');
    expect(sanitizedUrl).toBe(
      'postgres://tack_user@db.example.com:5433/tack_db?sslmode=verify-full&sslrootcert=%2Fpath%2Froot.crt',
    );
    expect(sanitizedUrl).toContain('sslmode=verify-full');
    expect(sanitizedUrl).toContain('sslrootcert=');
    expect(sanitizedUrl).not.toContain('secret_pass');
  });
});

describe('dumpDatabase', () => {
  it('throws validationFailed when databaseUrl is invalid', async () => {
    await expect(
      dumpDatabase({
        databaseUrl: 'invalid-url',
        outputFile: '/tmp/test.dump',
        databaseVersion: 'PostgreSQL 16',
        ledger: [],
        snapshotId: 'test-snap',
        counts: { workspaces: 0, users: 0, attachments: 0, issues: 0 },
      }),
    ).rejects.toThrow();
  });

  it('rejects with internal error when binary cannot be spawned', async () => {
    try {
      await dumpDatabase({
        databaseUrl: 'postgres://tack:tack@localhost:5432/tack',
        outputFile: '/tmp/test.dump',
        databaseVersion: 'PostgreSQL 16',
        ledger: [],
        snapshotId: 'test-snap',
        pgDumpPath: '/nonexistent/path/to/pg_dump_binary',
        counts: { workspaces: 0, users: 0, attachments: 0, issues: 0 },
      });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe('internal');
    }
  });
});
