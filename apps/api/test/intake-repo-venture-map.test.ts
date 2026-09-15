import { describe, it, expect } from 'vitest';
import { REPO_VENTURE_MAP, ventureForGitSignalTitle } from '../src/intake/repo-venture-map';

/**
 * `ventureForGitSignalTitle` is the exact inverse of `GitActivitySource`'s own
 * `title: `${label}: ${cleanSubject}`` — these tests exist to keep the two in sync, since
 * nothing in the type system would catch them silently drifting apart.
 */
describe('mapping a git-activity signal title to a venture', () => {
  it('resolves every repo actually in the map', () => {
    for (const [label, venture] of Object.entries(REPO_VENTURE_MAP)) {
      expect(ventureForGitSignalTitle(`${label}: Fix the collateral release order`)).toBe(
        venture,
      );
    }
  });

  it('returns null for a repo not in the map, rather than guessing', () => {
    expect(ventureForGitSignalTitle('some-unlisted-repo: Add a feature')).toBeNull();
  });

  it('returns null for a title with no ": " separator at all', () => {
    expect(ventureForGitSignalTitle('not a repo-prefixed title')).toBeNull();
  });

  it('splits on the FIRST ": " only, so a subject containing ": " is not misread', () => {
    expect(ventureForGitSignalTitle('uza-nexus: Fix: the collateral release order')).toBe(
      'NEXUS',
    );
  });

  it('deliberately excludes confirmed-dead or non-venture repos', () => {
    for (const excluded of ['battery', 'Battery-life', 'uzablueprint', 'serve']) {
      expect(REPO_VENTURE_MAP[excluded]).toBeUndefined();
      expect(ventureForGitSignalTitle(`${excluded}: some commit`)).toBeNull();
    }
  });
});
