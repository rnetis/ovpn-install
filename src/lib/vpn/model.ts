import type {
  Access,
  EnforceEvent,
  EventKind,
  ServerProfile,
  Session,
  Snap,
  VpnUser,
} from "@/lib/vpn/types";

export const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
export const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;

let seq = 0;

export function makeEvent(
  now: number,
  userName: string,
  kind: EventKind,
  detail: string,
): EnforceEvent {
  seq += 1;
  return { id: `e-${now}-${seq}`, at: now, userName, kind, detail };
}

export function blockingExpiry(user: VpnUser): number {
  return Math.min(user.expiresAt ?? Number.POSITIVE_INFINITY, user.certExpiresAt);
}

export function accessOf(user: VpnUser, now: number): Access {
  if (user.revoked) return "revoked";
  const exp = blockingExpiry(user);
  if (exp !== Number.POSITIVE_INFINITY && exp <= now) return "expired";
  if (user.quotaBytes != null && user.usedBytes >= user.quotaBytes) return "quota";
  return "active";
}

export function effectiveCap(user: VpnUser, server: ServerProfile): number {
  if (!server.duplicateCn) return 1;
  return Math.max(1, user.maxConcurrent);
}

export function ipInVpnSubnet(ip: string): boolean {
  const match = /^10\.8\.0\.(\d{1,3})$/.exec(ip.trim());
  if (!match) return false;
  const n = Number(match[1]);
  return n >= 2 && n <= 254;
}

const REAL_POOL = [
  "203.0.113.14",
  "203.0.113.22",
  "203.0.113.48",
  "198.51.100.10",
  "198.51.100.23",
  "198.51.100.77",
  "192.0.2.15",
  "192.0.2.44",
  "192.0.2.90",
];

export function nextVirtualIp(sessions: Session[]): string {
  const used = new Set(sessions.map((s) => s.virtualAddress));
  for (let n = 2; n <= 254; n += 1) {
    const ip = `10.8.0.${n}`;
    if (!used.has(ip)) return ip;
  }
  return "10.8.0.254";
}

export function newSession(userId: string, now: number, sessions: Session[], rates?: { rateIn: number; rateOut: number }): Session {
  const host = REAL_POOL[Math.floor(Math.random() * REAL_POOL.length)];
  const port = 20000 + Math.floor(Math.random() * 40000);
  const rateOut = rates?.rateOut ?? (40 + Math.floor(Math.random() * 180)) * 1024;
  const rateIn = rates?.rateIn ?? (4 + Math.floor(Math.random() * 36)) * 1024;
  return {
    id: `s-${now}-${seq + 1}-${port}`,
    userId,
    realAddress: `${host}:${port}`,
    virtualAddress: nextVirtualIp(sessions),
    connectedAt: now,
    bytesIn: 0,
    bytesOut: 0,
    rateIn,
    rateOut,
  };
}

function pushFresh(existing: EnforceEvent[], fresh: EnforceEvent[]): EnforceEvent[] {
  return fresh.slice().reverse().concat(existing).slice(0, 80);
}

export function step(state: Snap, now: number, opts: { accrue: boolean; sample: boolean }): Snap {
  const users = state.users.map((u) => ({ ...u }));
  let sessions = state.sessions.map((s) => ({ ...s }));
  const fresh: EnforceEvent[] = [];
  const byId = new Map(users.map((u) => [u.id, u]));

  let bps = 0;
  if (opts.accrue) {
    for (const s of sessions) {
      const user = byId.get(s.userId);
      if (!user) continue;
      s.bytesIn += s.rateIn;
      s.bytesOut += s.rateOut;
      user.usedBytes += s.rateIn + s.rateOut;
      bps += s.rateIn + s.rateOut;
    }
  }

  for (const user of users) {
    if (user.quotaCycle !== "monthly" || user.quotaBytes == null) continue;
    let hops = 0;
    while (now >= user.quotaAnchor + MONTH_MS && hops < 36) {
      user.quotaAnchor += MONTH_MS;
      hops += 1;
    }
    if (hops > 0) {
      user.usedBytes = 0;
      if (user.hold === "quota") user.hold = null;
      fresh.push(
        makeEvent(now, user.name, "quota-reset", "Monthly data cycle reset. Usage counter cleared."),
      );
    }
  }

  const blocked = new Set<string>();
  for (const user of users) {
    const access = accessOf(user, now);
    if (access === "active") {
      if (user.hold) {
        const prev = user.hold;
        user.hold = null;
        fresh.push(
          makeEvent(
            now,
            user.name,
            "enable",
            `Cleared ${prev} hold. CCD disable would be removed; the client may connect again.`,
          ),
        );
      }
      continue;
    }
    blocked.add(user.id);
    const had = sessions.some((s) => s.userId === user.id);
    sessions = sessions.filter((s) => s.userId !== user.id);
    if (user.hold !== access) {
      user.hold = access;
      fresh.push(makeEvent(now, user.name, blockKind(access), blockDetail(access, had)));
    }
  }

  for (const user of users) {
    if (blocked.has(user.id)) continue;
    const cap = effectiveCap(user, state.server);
    const mine = sessions.filter((s) => s.userId === user.id);
    if (mine.length <= cap) continue;
    const oldestFirst = mine.slice().sort((a, b) => a.connectedAt - b.connectedAt);
    const drop =
      state.server.concurrentPolicy === "keep-oldest"
        ? oldestFirst.slice(cap)
        : oldestFirst.slice(0, mine.length - cap);
    const dropIds = new Set(drop.map((s) => s.id));
    sessions = sessions.filter((s) => !dropIds.has(s.id));
    const native = !state.server.duplicateCn && user.maxConcurrent > 1;
    fresh.push(
      makeEvent(
        now,
        user.name,
        "kill-concurrent",
        native
          ? `Disconnected ${drop.length} extra session${drop.length === 1 ? "" : "s"}. Without duplicate-cn the hard cap is 1 (policy allows ${user.maxConcurrent}).`
          : `Disconnected ${drop.length} extra session${drop.length === 1 ? "" : "s"} (cap ${cap}, ${state.server.concurrentPolicy === "keep-newest" ? "keep newest" : "keep oldest"}).`,
      ),
    );
  }

  const known = new Set(users.map((u) => u.id));
  sessions = sessions.filter((s) => known.has(s.userId));

  return {
    ...state,
    users,
    sessions,
    events: pushFresh(state.events, fresh),
    samples: opts.sample ? state.samples.concat({ t: now, bps }).slice(-48) : state.samples,
    now,
  };
}

function blockKind(access: Access): EventKind {
  if (access === "quota") return "block-quota";
  if (access === "revoked") return "block-revoked";
  return "block-expiry";
}

function blockDetail(access: Access, hadSessions: boolean): string {
  const killed = hadSessions ? " Live sessions killed via the management socket." : "";
  if (access === "quota") {
    return `Data cap reached. Agent writes "disable" to the client CCD file.${killed}`;
  }
  if (access === "revoked") {
    return `Certificate revoked. Run openvpn-install.sh client revoke so the CRL matches.${killed}`;
  }
  return `Date reached (policy or certificate, whichever is sooner). Agent writes "disable" to CCD.${killed}`;
}

export interface ConnectResult {
  state: Snap;
  message: string;
  ok: boolean;
}

export function applyConnect(state: Snap, userId: string, now: number): ConnectResult {
  const user = state.users.find((u) => u.id === userId);
  if (!user) return { state, message: "Unknown client.", ok: false };
  const access = accessOf(user, now);
  if (access !== "active") {
    const message =
      access === "quota"
        ? `${user.name} is over the data cap.`
        : access === "expired"
          ? `${user.name} is past the expiry date.`
          : `${user.name} is revoked.`;
    return {
      ok: false,
      message,
      state: {
        ...state,
        now,
        events: pushFresh(state.events, [makeEvent(now, user.name, "refused", message)]),
      },
    };
  }

  let sessions = state.sessions.slice();
  const fresh: EnforceEvent[] = [];
  const mine = sessions.filter((s) => s.userId === userId);

  if (!state.server.duplicateCn) {
    if (mine.length >= 1) {
      sessions = sessions.filter((s) => s.userId !== userId);
      fresh.push(
        makeEvent(
          now,
          user.name,
          "kill-concurrent",
          user.maxConcurrent > 1
            ? "New login replaced the existing one. OpenVPN without duplicate-cn allows only one session, so a cap above 1 cannot be honored."
            : "New login replaced the previous session (OpenVPN default when duplicate-cn is off).",
        ),
      );
    }
  } else if (mine.length >= user.maxConcurrent) {
    if (state.server.concurrentPolicy === "keep-oldest") {
      const message = `${user.name} is at the concurrent cap (${user.maxConcurrent}). Oldest sessions are kept, so this login was refused.`;
      return {
        ok: false,
        message,
        state: {
          ...state,
          now,
          events: pushFresh(state.events, [makeEvent(now, user.name, "refused", message)]),
        },
      };
    }
    const oldest = mine.slice().sort((a, b) => a.connectedAt - b.connectedAt)[0];
    if (oldest) {
      sessions = sessions.filter((s) => s.id !== oldest.id);
      fresh.push(
        makeEvent(
          now,
          user.name,
          "kill-concurrent",
          `Cap is ${user.maxConcurrent}. Dropped the oldest session so this login can stay (keep newest).`,
        ),
      );
    }
  }

  const session = newSession(userId, now, sessions);
  sessions = sessions.concat(session);
  fresh.push(
    makeEvent(
      now,
      user.name,
      "connect",
      `Session from ${session.realAddress} on ${session.virtualAddress}.`,
    ),
  );
  return {
    ok: true,
    message: `${user.name} connected from ${session.realAddress}.`,
    state: { ...state, sessions, events: pushFresh(state.events, fresh), now },
  };
}
