# Contributing

## Setup

Requires [Bun](https://bun.sh) 1.3+ and Docker.

```bash
git clone https://github.com/Thefirstmannnn/tack.git
cd tack
bun install
cp .env.example .env
bun run infra:up
bun run db:push
bun run db:test-setup
bun run db:seed
bun run dev
```

## Development

```bash
bun run dev              # web on :3000, realtime on :3100
bun run verify           # lint, types, tests (same as CI)
cd packages/shared && bun test   # single package
```

## Rules

1. **Bun only.** No npm, pnpm, yarn.
2. **No Bun built-ins in shipped code.** Runtime is node on Vercel.
3. **No comments in code.** Build fails on them. Put meaning in names.
4. **Strict types.** No `any`, no non-null assertions.
5. **No em-dashes.**
6. **Tests required.** A feature needs a test that breaks if the feature breaks.

## Pull requests

Branch from `main`. Imperative commit messages with scope:

```
feat(issues): add board drag reorder
fix(realtime): drop expired sessions
```

Run `bun run verify` before pushing. Link issues with `Closes #123`.

By contributing you agree your work is licensed under [Apache 2.0](LICENSE).
