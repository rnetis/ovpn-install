import { MB_BYTES } from "@/lib/vpn/format";
import { makeEvent } from "@/lib/vpn/model";
import type { ServerProfile, Session, Snap, VpnUser } from "@/lib/vpn/types";

const DAY = 24 * 60 * 60 * 1000;
const GB = 1024 * MB_BYTES;

export const DEFAULT_SERVER: ServerProfile = {
  hostname: "edge-ams-01",
  publicIp: "203.0.113.40",
  port: 1194,
  protocol: "udp",
  subnet: "10.8.0.0/24",
  netmask: "255.255.255.0",
  dns: "Cloudflare",
  cipher: "AES-128-GCM",
  authMode: "pki",
  duplicateCn: true,
  concurrentPolicy: "keep-newest",
  tlsCrypt: true,
};

export const HOST_PATHS = {
  status: "/var/log/openvpn/status.log",
  socket: "/var/run/openvpn-server/server.sock",
  ccd: "/etc/openvpn/server/ccd",
  conf: "/etc/openvpn/server/server.conf",
  install: "/root/openvpn-install.sh",
  policy: "/etc/gatehouse/clients.json",
  state: "/var/lib/gatehouse/state.json",
  agent: "/usr/local/sbin/gatehouse-agent.py",
  unit: "openvpn-server@server",
} as const;

function user(partial: VpnUser): VpnUser {
  return partial;
}

export const INITIAL_SNAP: Snap = createSeed(Date.UTC(2026, 9, 5, 10, 0, 0));

export function createSeed(now: number): Snap {
  const users: VpnUser[] = [
    user({
      id: "alice",
      name: "alice",
      createdAt: now - 180 * DAY,
      expiresAt: now + 200 * DAY,
      certExpiresAt: now + 3400 * DAY,
      quotaBytes: 50 * GB,
      quotaCycle: "monthly",
      quotaAnchor: now - 10 * DAY,
      usedBytes: 18.4 * GB,
      maxConcurrent: 2,
      revoked: false,
      hold: null,
      note: "Staff laptop and phone",
      staticIp: "",
      passwordProtected: false,
    }),
    user({
      id: "bob.field",
      name: "bob.field",
      createdAt: now - 20 * DAY,
      expiresAt: now + 4 * DAY,
      certExpiresAt: now + 800 * DAY,
      quotaBytes: 10 * GB,
      quotaCycle: "none",
      quotaAnchor: now - 20 * DAY,
      usedBytes: 9.15 * GB,
      maxConcurrent: 1,
      revoked: false,
      hold: null,
      note: "Contractor, site survey",
      staticIp: "",
      passwordProtected: true,
    }),
    user({
      id: "pilot-phone",
      name: "pilot-phone",
      createdAt: now - 2 * DAY,
      expiresAt: now + 30 * DAY,
      certExpiresAt: now + 365 * DAY,
      quotaBytes: 64 * MB_BYTES,
      quotaCycle: "none",
      quotaAnchor: now - 2 * DAY,
      usedBytes: 60 * MB_BYTES,
      maxConcurrent: 1,
      revoked: false,
      hold: null,
      note: "Trial handset — data cap demo",
      staticIp: "",
      passwordProtected: false,
    }),
    user({
      id: "week-pass",
      name: "week-pass",
      createdAt: now - 6 * DAY,
      expiresAt: now + 45_000,
      certExpiresAt: now + 365 * DAY,
      quotaBytes: null,
      quotaCycle: "none",
      quotaAnchor: now,
      usedBytes: 1.2 * GB,
      maxConcurrent: 1,
      revoked: false,
      hold: null,
      note: "Short pass — date expiry demo",
      staticIp: "",
      passwordProtected: false,
    }),
    user({
      id: "noc-jump",
      name: "noc-jump",
      createdAt: now - 400 * DAY,
      expiresAt: null,
      certExpiresAt: now + 2000 * DAY,
      quotaBytes: null,
      quotaCycle: "none",
      quotaAnchor: now,
      usedBytes: 220 * GB,
      maxConcurrent: 3,
      revoked: false,
      hold: null,
      note: "Operations jump host",
      staticIp: "",
      passwordProtected: true,
    }),
    user({
      id: "kiosk-lobby",
      name: "kiosk-lobby",
      createdAt: now - 60 * DAY,
      expiresAt: now + 120 * DAY,
      certExpiresAt: now + 700 * DAY,
      quotaBytes: 5 * GB,
      quotaCycle: "none",
      quotaAnchor: now - 60 * DAY,
      usedBytes: 5 * GB,
      maxConcurrent: 1,
      revoked: false,
      hold: "quota",
      note: "Lobby kiosk, prepaid 5 GB",
      staticIp: "10.8.0.50",
      passwordProtected: false,
    }),
    user({
      id: "maria.cruz",
      name: "maria.cruz",
      createdAt: now - 90 * DAY,
      expiresAt: now + 40 * DAY,
      certExpiresAt: now + 400 * DAY,
      quotaBytes: 20 * GB,
      quotaCycle: "monthly",
      quotaAnchor: now - 5 * DAY,
      usedBytes: 2 * GB,
      maxConcurrent: 1,
      revoked: true,
      hold: "revoked",
      note: "Left the team",
      staticIp: "",
      passwordProtected: false,
    }),
    user({
      id: "ci-runner",
      name: "ci-runner",
      createdAt: now - 14 * DAY,
      expiresAt: now + 60 * DAY,
      certExpiresAt: now + 12 * DAY,
      quotaBytes: 2 * GB,
      quotaCycle: "none",
      quotaAnchor: now - 14 * DAY,
      usedBytes: 0.4 * GB,
      maxConcurrent: 1,
      revoked: false,
      hold: null,
      note: "Build agent — certificate is the sooner clock",
      staticIp: "",
      passwordProtected: false,
    }),
  ];

  const sessions: Session[] = [
    {
      id: "s-alice",
      userId: "alice",
      realAddress: "203.0.113.14:41820",
      virtualAddress: "10.8.0.2",
      connectedAt: now - 2 * 60 * 60 * 1000,
      bytesIn: 86 * MB_BYTES,
      bytesOut: 1.4 * GB,
      rateIn: 18 * 1024,
      rateOut: 160 * 1024,
    },
    {
      id: "s-bob",
      userId: "bob.field",
      realAddress: "198.51.100.23:33310",
      virtualAddress: "10.8.0.6",
      connectedAt: now - 25 * 60 * 1000,
      bytesIn: 40 * MB_BYTES,
      bytesOut: 610 * MB_BYTES,
      rateIn: 22 * 1024,
      rateOut: 90 * 1024,
    },
    {
      id: "s-pilot",
      userId: "pilot-phone",
      realAddress: "192.0.2.44:25110",
      virtualAddress: "10.8.0.14",
      connectedAt: now - 3 * 60 * 1000,
      bytesIn: 2 * MB_BYTES,
      bytesOut: 8 * MB_BYTES,
      rateIn: 24 * 1024,
      rateOut: 200 * 1024,
    },
    {
      id: "s-week",
      userId: "week-pass",
      realAddress: "203.0.113.48:19002",
      virtualAddress: "10.8.0.21",
      connectedAt: now - 40 * 60 * 1000,
      bytesIn: 12 * MB_BYTES,
      bytesOut: 90 * MB_BYTES,
      rateIn: 8 * 1024,
      rateOut: 40 * 1024,
    },
    {
      id: "s-noc-a",
      userId: "noc-jump",
      realAddress: "198.51.100.10:41002",
      virtualAddress: "10.8.0.8",
      connectedAt: now - 5 * 60 * 60 * 1000,
      bytesIn: 400 * MB_BYTES,
      bytesOut: 380 * MB_BYTES,
      rateIn: 30 * 1024,
      rateOut: 28 * 1024,
    },
    {
      id: "s-noc-b",
      userId: "noc-jump",
      realAddress: "198.51.100.77:41088",
      virtualAddress: "10.8.0.9",
      connectedAt: now - 50 * 60 * 1000,
      bytesIn: 20 * MB_BYTES,
      bytesOut: 22 * MB_BYTES,
      rateIn: 12 * 1024,
      rateOut: 14 * 1024,
    },
  ];

  const samples = Array.from({ length: 32 }, (_, i) => ({
    t: now - (32 - i) * 1000,
    bps: Math.round(520 * 1024 + 80 * 1024 * Math.sin(i / 3)),
  }));

  const events = [
    makeEvent(
      now - 2 * DAY,
      "kiosk-lobby",
      "block-quota",
      'Data cap reached. Agent writes "disable" to the client CCD file.',
    ),
    makeEvent(
      now - 1 * DAY,
      "maria.cruz",
      "revoke",
      "Revoked. On the server: /root/openvpn-install.sh client revoke maria.cruz",
    ),
    makeEvent(now - 6 * DAY, "week-pass", "add", "Issued week-pass. Policy expiry is under a minute from this demo clock."),
    makeEvent(now - 2 * DAY, "pilot-phone", "add", "Issued pilot-phone with a 64 MB cap so the quota block is visible."),
  ];

  return {
    seeded: true,
    users,
    sessions,
    events,
    samples,
    server: { ...DEFAULT_SERVER },
    now,
  };
}

export function replayFixtures(users: VpnUser[], sessions: Session[], now: number): { users: VpnUser[]; sessions: Session[] } {
  const nextUsers = users.map((u) => ({ ...u }));
  const ensure = (id: string, factory: (current: VpnUser | undefined) => VpnUser) => {
    const idx = nextUsers.findIndex((u) => u.id === id);
    const built = factory(idx >= 0 ? nextUsers[idx] : undefined);
    if (idx >= 0) nextUsers[idx] = built;
    else nextUsers.push(built);
  };

  ensure("pilot-phone", (current) => ({
    id: "pilot-phone",
    name: "pilot-phone",
    createdAt: current?.createdAt ?? now,
    expiresAt: now + 30 * DAY,
    certExpiresAt: current?.certExpiresAt ?? now + 365 * DAY,
    quotaBytes: 64 * MB_BYTES,
    quotaCycle: "none",
    quotaAnchor: now,
    usedBytes: 60 * MB_BYTES,
    maxConcurrent: 1,
    revoked: false,
    hold: null,
    note: current?.note || "Trial handset — data cap demo",
    staticIp: "",
    passwordProtected: false,
  }));

  ensure("week-pass", (current) => ({
    id: "week-pass",
    name: "week-pass",
    createdAt: current?.createdAt ?? now,
    expiresAt: now + 45_000,
    certExpiresAt: current?.certExpiresAt ?? now + 365 * DAY,
    quotaBytes: null,
    quotaCycle: "none",
    quotaAnchor: now,
    usedBytes: current?.usedBytes ?? 0,
    maxConcurrent: current?.maxConcurrent ?? 1,
    revoked: false,
    hold: null,
    note: current?.note || "Short pass — date expiry demo",
    staticIp: "",
    passwordProtected: false,
  }));

  const rest = sessions.filter((s) => s.userId !== "pilot-phone" && s.userId !== "week-pass");
  const demoSessions: Session[] = [
    {
      id: `s-pilot-${now}`,
      userId: "pilot-phone",
      realAddress: "192.0.2.44:25110",
      virtualAddress: rest.some((s) => s.virtualAddress === "10.8.0.14") ? "10.8.0.61" : "10.8.0.14",
      connectedAt: now,
      bytesIn: 0,
      bytesOut: 0,
      rateIn: 24 * 1024,
      rateOut: 200 * 1024,
    },
    {
      id: `s-week-${now}`,
      userId: "week-pass",
      realAddress: "203.0.113.48:19002",
      virtualAddress: rest.some((s) => s.virtualAddress === "10.8.0.21") ? "10.8.0.62" : "10.8.0.21",
      connectedAt: now,
      bytesIn: 0,
      bytesOut: 0,
      rateIn: 8 * 1024,
      rateOut: 40 * 1024,
    },
  ];

  return { users: nextUsers, sessions: rest.concat(demoSessions) };
}
