# Tack

A free, realtime, keyboard-first task manager. Issues, boards, sprints, projects and docs that update the moment anyone changes anything.

No pricing. No billing. No paid tiers.

## What it does

- Issues with priorities, labels, states, estimates, assignees, reviewers and relations
- Sprints with scope, points, burndown and carryover
- Projects and milestones with health tracking
- Rich docs with comments and public share links
- Standup view, analytics, search, saved views
- Realtime sync over websockets
- Keyboard first with command palette
- MCP server for AI agents
- Notifications with inbox, Slack and email
- GitHub PR integration
- Auth via passkeys, Google, GitHub, email OTP
- Role-based access control
- Light and dark themes

## Quick start

Requires [Bun](https://bun.sh) 1.3+ and Docker.

```bash
git clone https://github.com/Thefirstmannnn/tack.git
cd tack

bun install
cp .env.example .env

bun run infra:up        # postgres, redis and minio
bun run db:push         # create the schema
bun run db:seed         # load a demo workspace

bun run dev             # http://localhost:3000
```

Sign in as `alex@tack.example`. Press Cmd+K to explore.

| Service | Port |
| --- | --- |
| web | 3000 |
| realtime | 3100 |
| postgres | 5434 |
| redis | 6380 |
| minio | 9010 |

## Stack

TypeScript, Next.js 16, React 19, Postgres via Drizzle, Redis, Bun toolchain, node runtime.

## License

[Apache License 2.0](LICENSE)
