import { ID_PATTERNS, type IdKind } from '@uza/contracts';

/**
 * Readable identifiers layered over UUID primary keys (CF-001). The patterns live in
 * @uza/contracts (ID_PATTERNS); this module renders and validates against them so the
 * pattern is defined in exactly one place.
 *
 * Tokens: {seq:N} → N-wide zero-padded number; {year} → 4 digits; every other token is
 * a caller-supplied segment (country, office, venture, trigger, parent, order).
 */
export type IdParts = Record<string, string | number>;

const TOKEN = /\{(\w+)(?::(\d+))?\}/g;

export function formatId(kind: IdKind, parts: IdParts): string {
  const pattern: string = ID_PATTERNS[kind];
  return pattern.replace(TOKEN, (_m, name: string, width?: string) => {
    const value = parts[name];
    if (value === undefined) {
      throw new Error(`readable id ${kind}: missing part "${name}"`);
    }
    if (name === 'seq' || width) {
      const n = Number(value);
      return String(n).padStart(width ? Number(width) : 1, '0');
    }
    return String(value);
  });
}

/** A RegExp that validates a rendered id of this kind (used by the CF-001 test). */
export function idRegex(kind: IdKind): RegExp {
  const pattern: string = ID_PATTERNS[kind];
  const body = pattern.replace(/[.*+?^${}()|[\]\\]/g, (c) =>
    c === '{' || c === '}' ? c : `\\${c}`,
  );
  const src = body.replace(TOKEN, (_m, name: string, width?: string) => {
    if (name === 'year') return '\\d{4}';
    if (name === 'seq' || width) return `\\d{${width ?? '1,'}}`;
    return '[A-Za-z0-9]+';
  });
  return new RegExp(`^${src}$`);
}
