import { describe, expect, test } from 'bun:test';
import { breadcrumbsFor } from '../../src/lib/breadcrumbs.ts';

describe('breadcrumbsFor', () => {
  test('a workspace-only path yields a single, non-navigable crumb', () => {
    expect(breadcrumbsFor('/', 'mbhatt')).toEqual([{ label: 'mbhatt' }]);
  });

  test('the workspace crumb links home and the current page does not link', () => {
    expect(breadcrumbsFor('/inbox', 'mbhatt')).toEqual([
      { label: 'mbhatt', href: '/' },
      { label: 'Inbox' },
    ]);
  });

  test('a navigable ancestor links while the leaf stays plain text', () => {
    expect(breadcrumbsFor('/docs/new', 'mbhatt')).toEqual([
      { label: 'mbhatt', href: '/' },
      { label: 'Docs', href: '/docs' },
      { label: 'New' },
    ]);
  });

  test('nested settings expose every navigable ancestor as a link', () => {
    expect(breadcrumbsFor('/settings/account/passkeys', 'mbhatt')).toEqual([
      { label: 'mbhatt', href: '/' },
      { label: 'Settings', href: '/settings' },
      { label: 'Account', href: '/settings/account' },
      { label: 'Passkeys' },
    ]);
  });

  test('ancestors without their own page never become links', () => {
    expect(breadcrumbsFor('/team/eng/issues', 'mbhatt')).toEqual([
      { label: 'mbhatt', href: '/' },
      { label: 'Team' },
      { label: 'Eng' },
      { label: 'Issues' },
    ]);
  });

  test('opaque id segments drop from labels but stay in ancestor hrefs', () => {
    expect(breadcrumbsFor('/docs/1b3f6c2e-0a4d-4e2f-9c1a-7d5e8f0a1b2c', 'mbhatt')).toEqual([
      { label: 'mbhatt', href: '/' },
      { label: 'Docs' },
    ]);
  });

  test('an unrouted parent stays text even with a real leaf', () => {
    expect(breadcrumbsFor('/issue/ENG-123', 'mbhatt')).toEqual([
      { label: 'mbhatt', href: '/' },
      { label: 'Issue' },
      { label: 'ENG 123' },
    ]);
  });

  test('multi-word segments titleize on hyphen', () => {
    expect(breadcrumbsFor('/my-issues', 'mbhatt')).toEqual([
      { label: 'mbhatt', href: '/' },
      { label: 'My issues' },
    ]);
  });

  test('an acronym segment keeps its casing instead of titleizing', () => {
    expect(breadcrumbsFor('/settings/mcp', 'mbhatt')).toEqual([
      { label: 'mbhatt', href: '/' },
      { label: 'Settings', href: '/settings' },
      { label: 'MCP server' },
    ]);
  });
});
