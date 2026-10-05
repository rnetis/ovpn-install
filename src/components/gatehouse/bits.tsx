import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/vpn/format";
import { accessOf } from "@/lib/vpn/model";
import type { Access, VpnUser } from "@/lib/vpn/types";

export const controlClass =
  "h-11 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg outline-none focus:border-primary";

const TONE: Record<Access | "warn", string> = {
  active: "bg-ok/15 text-ok",
  expired: "bg-danger/15 text-danger",
  quota: "bg-danger/15 text-danger",
  revoked: "bg-surface-2 text-muted",
  warn: "bg-primary/15 text-primary",
};

const LABEL: Record<Access, string> = {
  active: "Active",
  expired: "Expired",
  quota: "Data cap",
  revoked: "Revoked",
};

export function statusTone(user: VpnUser, now: number): { label: string; tone: Access | "warn" } {
  const access = accessOf(user, now);
  if (access !== "active") return { label: LABEL[access], tone: access };
  const sooner = Math.min(user.expiresAt ?? Number.POSITIVE_INFINITY, user.certExpiresAt);
  if (sooner - now < 7 * 24 * 60 * 60 * 1000) return { label: "Expiring", tone: "warn" };
  if (user.quotaBytes != null && user.usedBytes / user.quotaBytes >= 0.85) return { label: "Near cap", tone: "warn" };
  return { label: "Active", tone: "active" };
}

export function StatusPill({ user, now }: { user: VpnUser; now: number }) {
  const status = statusTone(user, now);
  return (
    <span className={cn("inline-flex h-6 items-center rounded-sm px-2 text-xs font-medium", TONE[status.tone])}>
      {status.label}
    </span>
  );
}

export function QuotaBar({ used, cap }: { used: number; cap: number | null }) {
  if (cap == null) {
    return <p className="text-sm text-muted">Unlimited · {formatBytes(used)} moved</p>;
  }
  const pct = Math.min(100, cap === 0 ? 100 : (used / cap) * 100);
  const bar = pct >= 100 ? "bg-danger" : pct >= 85 ? "bg-primary" : "bg-ok";
  return (
    <div>
      <div className="flex justify-between gap-3 text-xs text-muted tabular-nums">
        <span>{formatBytes(used)}</span>
        <span>{formatBytes(cap)}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className={cn("h-full rounded-full", bar)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg bg-surface p-4 shadow-card", className)}>
      {title ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
