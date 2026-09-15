import { formatAmount, formatMoney } from "@/lib/pricing";

/** Bare grouped number, e.g. "3,500". Use where the RWF label is already shown. */
export const rwf = formatAmount;

/** Full money label, e.g. "RWF 3,500". */
export const rwfFull = formatMoney;

export function shortTime(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function shortDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString([], { day: "2-digit", month: "short" });
}
