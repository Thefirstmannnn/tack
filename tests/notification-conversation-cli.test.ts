import { expect, it } from 'bun:test';

for (const value of ['0', '9', '1.5', 'invalid']) {
  it(`backfill rejects unsafe source concurrency ${value}`, async () => {
    const child = Bun.spawn(
      [
        'bun',
        'scripts/notification-conversation-backfill.ts',
        '--all',
        `--source-concurrency=${value}`,
      ],
      {
        cwd: `${import.meta.dir}/..`,
        env: { ...process.env, DATABASE_URL: 'postgres://tack:tack@127.0.0.1:1/tack_test' },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    );
    const [code, error] = await Promise.all([child.exited, new Response(child.stderr).text()]);
    expect(code).not.toBe(0);
    expect(error).toMatch(/positive integer|between 1 and 8/);
  });
}

for (const script of ['backfill', 'verify']) {
  for (const args of [[], ['--all', '--organization=example'], ['--organization=']]) {
    it(`${script} refuses unsafe organization scope ${JSON.stringify(args)}`, async () => {
      const child = Bun.spawn(['bun', `scripts/notification-conversation-${script}.ts`, ...args], {
        cwd: `${import.meta.dir}/..`,
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const [code, error] = await Promise.all([child.exited, new Response(child.stderr).text()]);
      expect(code).not.toBe(0);
      expect(error).toMatch(/Choose --all|cannot be empty/);
    });
  }
}
