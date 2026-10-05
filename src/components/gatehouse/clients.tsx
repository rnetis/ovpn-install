import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useApi } from "@/components/gatehouse/api";
import { controlClass, QuotaBar, StatusPill } from "@/components/gatehouse/bits";
import { Button } from "@/components/ui/button";
import { expiryPhrase } from "@/lib/vpn/format";
import { downloadText, ovpnProfile, revokeCommand } from "@/lib/vpn/files";
import { accessOf } from "@/lib/vpn/model";
import type { VpnUser } from "@/lib/vpn/types";

const FILTERS = ["all", "online", "expiring", "blocked", "revoked"] as const;
type Filter = (typeof FILTERS)[number];

export function Clients({
  query,
  onQuery,
  onEdit,
  onCreate,
}: {
  query: string;
  onQuery: (value: string) => void;
  onEdit: (id: string) => void;
  onCreate: () => void;
}) {
  const api = useApi();
  const { users, sessions, server, now, connect, disconnectUser, resetUsage, revokeUser, reissueUser } = api;
  const [filter, setFilter] = useState<Filter>("all");
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const revokeTarget = users.find((u) => u.id === revokeId) ?? null;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((user) => {
      if (q && !`${user.name} ${user.note}`.toLowerCase().includes(q)) return false;
      const access = accessOf(user, now);
      const online = sessions.some((s) => s.userId === user.id);
      if (filter === "online") return online;
      if (filter === "blocked") return access === "expired" || access === "quota";
      if (filter === "revoked") return access === "revoked";
      if (filter === "expiring") {
        const sooner = Math.min(user.expiresAt ?? Number.POSITIVE_INFINITY, user.certExpiresAt);
        return access === "active" && sooner - now < 7 * 24 * 60 * 60 * 1000;
      }
      return true;
    });
  }, [users, query, filter, now, sessions]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input
            className={`${controlClass} pl-9`}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search clients"
            aria-label="Search clients"
          />
        </div>
        <Button type="button" onClick={onCreate}>
          Issue client
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={`h-11 rounded-full px-4 text-sm capitalize ${filter === item ? "bg-primary text-primary-fg" : "bg-surface text-muted shadow-card"}`}
          >
            {item}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg bg-surface p-6 text-sm text-muted shadow-card">No clients match.</p>
      ) : (
        <ul className="grid gap-3 xl:grid-cols-2">
          {rows.map((user) => {
            const mine = sessions.filter((s) => s.userId === user.id);
            return (
              <li key={user.id} className="rounded-lg bg-surface p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate font-medium">{user.name}</h2>
                      <StatusPill user={user} now={now} />
                      {user.passwordProtected ? <span className="text-xs text-muted">key password</span> : null}
                    </div>
                    <p className="truncate text-sm text-muted">{user.note || "No note"}</p>
                  </div>
                  <RowMenu
                    user={user}
                    onEdit={() => onEdit(user.id)}
                    onProfile={() => downloadText(`${user.name}.ovpn`, ovpnProfile(server, user))}
                    onDisconnect={() => {
                      disconnectUser(user.id);
                      toast(`Disconnected ${user.name}`);
                    }}
                    onReset={() => {
                      resetUsage(user.id);
                      toast(`Reset usage for ${user.name}`);
                    }}
                    onRevoke={() => setRevokeId(user.id)}
                    onReissue={() => {
                      reissueUser(user.id);
                      toast(`Reissued ${user.name}`);
                    }}
                  />
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs text-muted">
                      Data{user.quotaCycle === "monthly" && user.quotaBytes != null ? " · resets every 30 days" : ""}
                    </p>
                    <QuotaBar used={user.usedBytes} cap={user.quotaBytes} />
                  </div>
                  <div className="grid content-start gap-1 text-sm">
                    <p className="text-xs text-muted">Sessions</p>
                    <p className="font-medium tabular-nums">
                      {mine.length} / {user.maxConcurrent}
                      {!server.duplicateCn && user.maxConcurrent > 1 ? (
                        <span className="font-normal text-muted"> · server allows 1</span>
                      ) : null}
                    </p>
                    <p className="text-muted">{expiryPhrase(user, now)}</p>
                    {user.staticIp ? <p className="font-mono text-xs text-muted">{user.staticIp}</p> : null}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      const result = connect(user.id);
                      if (result.ok) toast.success(result.message);
                      else toast.error(result.message);
                    }}
                  >
                    Connect
                  </Button>
                  <Button type="button" variant="outline" onClick={() => onEdit(user.id)}>
                    Limits
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog.Root open={revokeTarget != null} onOpenChange={(open) => !open && setRevokeId(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-40 bg-bg/70" />
          <AlertDialog.Content className="fixed inset-x-3 top-24 z-50 rounded-lg bg-surface p-5 shadow-pop outline-none md:left-1/2 md:w-full md:max-w-md md:-translate-x-1/2">
            <AlertDialog.Title className="text-lg font-semibold">Revoke {revokeTarget?.name}?</AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm text-muted">
              This is the destructive path. On the server it updates the CRL and disconnects the client. A date or data block only writes disable and can be undone.
            </AlertDialog.Description>
            {revokeTarget ? (
              <p className="mt-3 break-all rounded-md bg-bg px-3 py-2 font-mono text-xs text-muted">{revokeCommand(revokeTarget.name)}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <AlertDialog.Action asChild>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => {
                    if (!revokeTarget) return;
                    revokeUser(revokeTarget.id);
                    toast.success(`Revoked ${revokeTarget.name}`);
                    setRevokeId(null);
                  }}
                >
                  Revoke certificate
                </Button>
              </AlertDialog.Action>
              <AlertDialog.Cancel asChild>
                <Button type="button" variant="ghost">
                  Keep
                </Button>
              </AlertDialog.Cancel>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}

function RowMenu({
  user,
  onEdit,
  onProfile,
  onDisconnect,
  onReset,
  onRevoke,
  onReissue,
}: {
  user: VpnUser;
  onEdit: () => void;
  onProfile: () => void;
  onDisconnect: () => void;
  onReset: () => void;
  onRevoke: () => void;
  onReissue: () => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label={`Actions for ${user.name}`}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="z-50 min-w-44 rounded-md bg-surface p-1 shadow-pop" align="end" sideOffset={6}>
          <Item onSelect={onEdit}>Edit limits</Item>
          <Item onSelect={onProfile}>Download demo profile</Item>
          <Item onSelect={onDisconnect}>Disconnect sessions</Item>
          <Item onSelect={onReset}>Reset data counter</Item>
          {user.revoked ? <Item onSelect={onReissue}>Reissue access</Item> : <Item onSelect={onRevoke}>Revoke…</Item>}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function Item({ children, onSelect }: { children: string; onSelect: () => void }) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className="flex h-11 cursor-pointer items-center rounded-sm px-3 text-sm outline-none data-[highlighted]:bg-surface-2"
    >
      {children}
    </DropdownMenu.Item>
  );
}
