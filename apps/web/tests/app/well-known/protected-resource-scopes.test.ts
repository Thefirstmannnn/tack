import { describe, expect, it } from 'bun:test';
import { withTackScopes } from '../../../src/app/.well-known/oauth-protected-resource/route.ts';
import { MCP_SCOPES } from '../../../src/lib/auth/server.ts';

describe('the protected resource metadata', () => {
  it('advertises every scope the authorization server issues', () => {
    const metadata = withTackScopes({
      resource: 'https://YOUR_DOMAIN/mcp',
      scopes_supported: ['openid', 'profile', 'email', 'offline_access'],
    });

    expect(metadata['scopes_supported']).toEqual([...MCP_SCOPES]);
  });

  it('names the scopes the tools actually require, which is what a client asks for', () => {
    const advertised = withTackScopes({})['scopes_supported'];

    expect(advertised).toContain('tack.read');
    expect(advertised).toContain('tack.write');
  });

  it('leaves the rest of the document alone', () => {
    const metadata = withTackScopes({
      resource: 'https://YOUR_DOMAIN/mcp',
      authorization_servers: ['https://YOUR_DOMAIN'],
      jwks_uri: 'https://YOUR_DOMAIN/api/auth/mcp/jwks',
    });

    expect(metadata['resource']).toBe('https://YOUR_DOMAIN/mcp');
    expect(metadata['authorization_servers']).toEqual(['https://YOUR_DOMAIN']);
    expect(metadata['jwks_uri']).toBe('https://YOUR_DOMAIN/api/auth/mcp/jwks');
  });
});
