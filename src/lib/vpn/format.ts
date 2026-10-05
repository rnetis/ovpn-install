import { format, formatDistanceToNowStrict } from "date-fns";
import type { VpnUser } from "@/lib/vpn/types";
import { blockingExpiry } from "@/lib/vpn/model";

const KB = 1024;
const MB = 1024 * KB;
const GB = 1024 * MB;
const TB = 1024 * GB;

export function formatBytes(n: number): string {
  const v = Math.max(0, n);
  if (v < KB) return `${Math.round(v)} B`;
  const units = [
    { s: KB, l: "KB" },
    { s: MB, l: "MB" },
    { s: GB, l: "GB" },
    { s: TB, l: "TB" },
  ];
  let pick = units[0];
  for (const u of units) {
    if (v >= u.s) pick = u;
  }
  const num = v / pick.s;
  const digits = num >= 100 ? 0 : num >= 10 ? 1 : 2;
  return `${num.toFixed(digits)} ${pick.l}`;
}

export function formatWhen(ms: number): string {
  return format(ms, "d MMM yyyy HH:mm");
}

export function formatDay(ms: number): string {
  return format(ms, "d MMM yyyy");
}

export function expiryPhrase(user: VpnUser, now: number): string {
  const t = blockingExpiry(user);
  if (t == null) return "No expiry";
  const kind = expiryKind(user);
  const tail = kind ? ` · ${kind}` : "";
  if (t <= now) return `Expired ${formatDistanceToNowStrict(t, { addSuffix: true })}${tail}`;
  return `Expires ${formatDistanceToNowStrict(t, { addSuffix: true })}${tail}`;
}

export function expiryKind(user: VpnUser): "policy" | "certificate" | null {
  const t = blockingExpiry(user);
  if (t == null) return null;
  if (user.expiresAt != null && user.expiresAt <= user.certExpiresAt) return "policy";
  return "certificate";
}

export function formatRemain(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return `${m}m ${String(r).padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function toDateInput(ms: number | null): string {
  if (ms == null) return "";
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** End of the chosen local day, so the date itself still allows access. */
export function fromDateInput(value: string): number | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

export function bytesToGbInput(bytes: number): string {
  const gb = bytes / GB;
  const digits = gb >= 10 ? 1 : 2;
  return String(Number(gb.toFixed(digits)));
}

export const GB_BYTES = GB;
export const MB_BYTES = MB;
