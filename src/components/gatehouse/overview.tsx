import { formatDistance } from "date-fns";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import { useApi } from "@/components/gatehouse/api";
import { Panel, StatusPill } from "@/components/gatehouse/bits";
import { Button } from "@/components/ui/button";
import { expiryPhrase, formatBytes, formatRemain } from "@/lib/vpn/format";
import { accessOf, blockingExpiry } from "@/lib/vpn/model";

export function Overview({ onOpenUser }: { onOpenUser: (name: string) => void }) {
  const api = useApi();
  const { users, sessions, samples, events, now, replayDemos: replay } = api;

  const onlineUsers = new Set(sessions.map((s) => s.userId)).size;
  const blocked = users.filter((u) => accessOf(u, now) !== "active").length;
  const expiring = users.filter((u) => {
    if (accessOf(u, now) !== "active") return false;
    return blockingExpiry(u) - now < 7 * 24 * 60 * 60 * 1000;
  }).length;
  const bps = samples.at(-1)?.bps ?? sessions.reduce((sum, s) => sum + s.rateIn + s.rateOut, 0);

  const live = users.flatMap((user) => {
    const lines: { id: string; text: string }[] = [];
    if (user.quotaBytes != null && accessOf(user, now) === "active") {
      const left = user.quotaBytes - user.usedBytes;
      const rate = sessions.filter((s) => s.userId === user.id).reduce((sum, s) => sum + s.rateIn + s.rateOut, 0);
      if (left > 0 && rate > 0) {
        const sec = left / rate;
        if (sec < 180) lines.push({ id: `${user.id}-q`, text: `${user.name} hits its data cap in ${formatRemain(sec)}` });
      }
    }
    if (accessOf(user, now) === "active") {
      const left = (blockingExpiry(user) - now) / 1000;
      if (left > 0 && left < 180) lines.push({ id: `${user.id}-d`, text: `${user.name} expires in ${formatRemain(left)}` });
    }
    return lines;
  });

  const attention = users
    .filter((user) => {
      const access = accessOf(user, now);
      if (access !== "active") return true;
      if (blockingExpiry(user) - now < 7 * 24 * 60 * 60 * 1000) return true;
      if (user.quotaBytes != null && user.usedBytes / user.quotaBytes >= 0.85) return true;
      return false;
    })
    .slice(0, 6);

  return (
    <div className="grid gap-4">
      {live.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Enforcement is running on this demo host</p>
            <ul className="mt-1 grid gap-0.5 text-sm text-fg">
              {live.map((line) => (
                <li key={line.id} className="tabular-nums">
                  {line.text}
                </li>
              ))}
            </ul>
          </div>
          <Button type="button" variant="outline" onClick={replay}>
            Replay limits
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sessions" value={String(sessions.length)} hint={`${onlineUsers} clients`} />
        <Stat label="Throughput" value={formatBytes(bps)} hint="per second" />
        <Stat label="Expiring" value={String(expiring)} hint="inside 7 days" />
        <Stat label="Blocked" value={String(blocked)} hint="date, data, or revoke" />
      </div>

      <Panel title="Traffic on the simulated status log">
        <div className="h-40 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={samples} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
              <Tooltip
                formatter={(value) => [`${formatBytes(Number(value))}/s`, "Throughput"]}
                labelFormatter={() => ""}
                contentStyle={{
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  color: "var(--color-fg)",
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="bps"
                stroke="var(--color-primary)"
                fill="var(--color-primary)"
                fillOpacity={0.18}
                strokeWidth={2}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Needs a look">
          {attention.length === 0 ? (
            <p className="text-sm text-muted">Nothing is close to a limit.</p>
          ) : (
            <ul className="grid gap-2">
              {attention.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => onOpenUser(user.name)}
                    className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left hover:bg-surface-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{user.name}</span>
                      <span className="block truncate text-sm text-muted">{expiryPhrase(user, now)}</span>
                    </span>
                    <StatusPill user={user} now={now} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent enforcement">
          <ul className="grid gap-3">
            {events.slice(0, 5).map((event) => (
              <li key={event.id} className="grid gap-0.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium">{event.userName}</span>
                  <span className="shrink-0 text-xs text-muted tabular-nums">
                    {formatDistance(event.at, now, { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm text-muted">{event.detail}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Rule
          title="Date expiry"
          body="The sooner of the policy date and the certificate end. The agent writes disable into ccd/ and kills the tunnel. Revoke is separate — that burns the cert via openvpn-install.sh."
        />
        <Rule
          title="Data cap"
          body="Upload plus download. Hit the cap and the same disable lands until you raise it, reset the counter, or the 30-day cycle rolls."
        />
        <Rule
          title="Concurrent cap"
          body="Each client has its own number. Caps above 1 need duplicate-cn, which angristan does not turn on. The agent then kills the extras."
        />
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg bg-surface p-4 shadow-card">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 truncate text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted">{hint}</p>
    </div>
  );
}

function Rule({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-lg bg-surface p-4 shadow-card">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </article>
  );
}
