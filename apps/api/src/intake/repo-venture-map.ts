/**
 * Which venture a repo's git activity belongs to.
 *
 * `GitActivitySource` files a signal's `title` as `${repoLabel}: ${subject}`, where
 * `repoLabel` is the repo directory's own basename (see that file's doc comment) — never
 * a venture code, because a repo doesn't know which venture it belongs to any more than a
 * commit does. This is the one place that answers "which venture," kept separate from the
 * source itself so onboarding a new repo into `UZA_GIT_REPOS` and deciding which venture it
 * counts toward are two different, independently-reviewable decisions.
 *
 * Deliberately a plain object, not a database table: this changes only when a new repo is
 * onboarded or a venture is reclassified, which is a reviewed-commit event, not runtime data
 * — the same reasoning `lenders.registry.ts` gives in uza-mobility-bn for its own registry.
 */
export const REPO_VENTURE_MAP: Readonly<Record<string, string>> = {
  'uza-nexus': 'NEXUS',
  'uza-mobility-bn': 'MOBILITY',
  'uza-mobility-fn': 'MOBILITY',
  'uza-mobility-admin': 'MOBILITY',
  uzacharge: 'CHARGE',
  uzabuild: 'BUILD',
  // Its own README calls it "UZA Mobility — Driver EV Ownership Programme," but it genuinely
  // overlaps uza-mobility-bn's real Tunga Taxi/Academy/lender-matching system — see
  // lovable-projects-inventory-2026-09 in memory. Filed under MOBILITY because that's what
  // its own branding claims, not because the overlap is resolved.
  evfleet: 'MOBILITY',
  'UZA-BATTERY-VALUE-CHAIN-STRATEGY': 'CHARGE',
  'UZA Solutions guide': 'GROUP',
  // `serve` (a restaurant POS, not a UZA venture) and `battery`/`Battery-life`/`uzablueprint`
  // (confirmed dead — see the same inventory memory) are deliberately absent: activity there
  // should not be attributed to any venture's overview.
};

/**
 * `label` is the text before the first ": " in a git_commit signal's `title` — the exact
 * inverse of `GitActivitySource`'s `title: `${label}: ${cleanSubject}``. Returns `null` for
 * a repo not in the map (unrecognised, or deliberately excluded), never a guess.
 */
export function ventureForGitSignalTitle(title: string): string | null {
  const sep = title.indexOf(': ');
  if (sep < 0) return null;
  const label = title.slice(0, sep);
  return REPO_VENTURE_MAP[label] ?? null;
}
