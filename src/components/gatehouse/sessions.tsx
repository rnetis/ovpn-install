import { formatDistance } from "date-fns";
import { toast } from "sonner";
import { useApi } from "@/components/gatehouse/api";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/vpn/format";

export function Sessions() {
  const { sessions, users, now, killSession } = useApi();
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? id;

  if (sessions.length === 0) {
    return (
      <p className="rounded-lg bg-surface p-6 text-sm text-muted shadow-card">
        Nobody is connected. Issue a client or press Connect on someone who is still allowed in.
      </p>
    );
  }

  return (
    <ul className="grid gap-3">
      {sessions
        .slice()
        .sort((a, b) => b.connectedAt - a.connectedAt)
        .map((session) => (
          <li key={session.id} className="rounded-lg bg-surface p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate font-medium">{nameOf(session.userId)}</h2>
                <p className="font-mono text-xs text-muted">
                  {session.realAddress} → {session.virtualAddress}
                </p>
              </div>
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  killSession(session.id);
                  toast(`Killed ${session.realAddress}`);
                }}
              >
                Kill
              </Button>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Cell label="Up" value={formatBytes(session.bytesIn)} />
              <Cell label="Down" value={formatBytes(session.bytesOut)} />
              <Cell label="Rate" value={`${formatBytes(session.rateIn + session.rateOut)}/s`} />
              <Cell label="Since" value={formatDistance(session.connectedAt, now, { addSuffix: true })} />
            </dl>
          </li>
        ))}
    </ul>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
