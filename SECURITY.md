# Security

## Reporting

Do not open a public issue. Use one of:

- [Private advisory](https://github.com/Thefirstmannnn/tack/security/advisories/new) on GitHub (preferred)
- Email YOUR_EMAIL with `SECURITY` in subject

Include: what the problem is, steps to reproduce, version/commit, severity estimate.

Acknowledgement within 72 hours. Confirmed issues fixed within 30 days.

## Scope

In scope: auth, authorization, realtime access control, MCP OAuth, injection, XSS, SSRF, file uploads, webhook verification, secret leaks.

Out of scope: anything requiring `TACK_DEV_LOGIN=1`, scanner output without reproduction, rate limiting, DoS via volume, social engineering, misconfigured self-hosted deployments.

## Self-hosting checklist

- Set `BETTER_AUTH_SECRET` to a fresh random value
- Never set `TACK_DEV_LOGIN` in production
- Never expose Postgres, Redis or object storage to the internet
- Change all default credentials from `docker-compose.yml`
- Serve over HTTPS
