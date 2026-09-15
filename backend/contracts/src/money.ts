/** Money is integer minor units. Never floats. 1234 === $12.34 */
export type Minor = number & { readonly __brand: 'Minor' };

export const minor = (major: number): Minor => Math.round(major * 100) as Minor;
export const toMajor = (m: Minor): number => m / 100;
export const pct = (m: Minor, fraction: number): Minor => Math.round(m * fraction) as Minor;
export const sum = (...xs: Minor[]): Minor => xs.reduce((a, b) => (a + b) as Minor, 0 as Minor);

/** Forwarders bill on the greater of volume or weight. */
export const revenueTon = (cbm: number, kg: number): number =>
  Math.round(Math.max(cbm, kg / 1000) * 1000) / 1000;
