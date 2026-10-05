import { create } from "zustand";
import { persist } from "zustand/middleware";
import { applyConnect, makeEvent, step } from "@/lib/vpn/model";
import { createSeed, DEFAULT_SERVER, replayFixtures } from "@/lib/vpn/seed";
import type { ServerProfile, Snap, VpnUser } from "@/lib/vpn/types";

export interface NewUserInput {
  name: string;
  expiresAt: number | null;
  certExpiresAt: number;
  quotaBytes: number | null;
  quotaCycle: VpnUser["quotaCycle"];
  maxConcurrent: number;
  note: string;
  staticIp: string;
  passwordProtected: boolean;
}

export interface UserPatch {
  expiresAt: number | null;
  certExpiresAt: number;
  quotaBytes: number | null;
  quotaCycle: VpnUser["quotaCycle"];
  maxConcurrent: number;
  note: string;
  staticIp: string;
  passwordProtected: boolean;
}

interface Actions {
  tick: (now: number) => void;
  connect: (userId: string) => { ok: boolean; message: string };
  killSession: (sessionId: string) => void;
  disconnectUser: (userId: string) => void;
  addUser: (input: NewUserInput) => void;
  updateUser: (id: string, patch: UserPatch) => void;
  revokeUser: (id: string) => void;
  reissueUser: (id: string) => void;
  renewCert: (id: string) => void;
  resetUsage: (id: string) => void;
  setServer: (patch: Partial<ServerProfile>) => void;
  resetDemo: () => void;
  replayDemos: () => void;
  importUsers: (users: VpnUser[], serverPatch?: Partial<ServerProfile>) => void;
}

const empty = (): Snap => ({
  seeded: false,
  users: [],
  sessions: [],
  events: [],
  samples: [],
  server: { ...DEFAULT_SERVER },
  now: 0,
});

function commit(state: Snap, next: Snap, now: number): Snap {
  return step(next, now, { accrue: false, sample: false });
}

export const useVpn = create<Snap & Actions>()(
  persist(
    (set) => ({
      ...empty(),
      tick: (now) => set((state) => step(state, now, { accrue: true, sample: true })),
      connect: (userId) => {
        let result = { ok: false, message: "Not connected." };
        set((state) => {
          const applied = applyConnect(state, userId, Date.now());
          result = { ok: applied.ok, message: applied.message };
          return applied.state;
        });
        return result;
      },
      killSession: (sessionId) =>
        set((state) => {
          const now = Date.now();
          const session = state.sessions.find((s) => s.id === sessionId);
          if (!session) return state;
          const user = state.users.find((u) => u.id === session.userId);
          return {
            ...state,
            now,
            sessions: state.sessions.filter((s) => s.id !== sessionId),
            events: [
              makeEvent(
                now,
                user?.name ?? session.userId,
                "disconnect",
                `Killed ${session.realAddress} via management socket.`,
              ),
              ...state.events,
            ].slice(0, 80),
          };
        }),
      disconnectUser: (userId) =>
        set((state) => {
          const now = Date.now();
          const user = state.users.find((u) => u.id === userId);
          const n = state.sessions.filter((s) => s.userId === userId).length;
          if (!user || n === 0) return state;
          return {
            ...state,
            now,
            sessions: state.sessions.filter((s) => s.userId !== userId),
            events: [
              makeEvent(now, user.name, "disconnect", `Disconnected ${n} session${n === 1 ? "" : "s"}.`),
              ...state.events,
            ].slice(0, 80),
          };
        }),
      addUser: (input) =>
        set((state) => {
          const now = Date.now();
          const row: VpnUser = {
            id: input.name,
            name: input.name,
            createdAt: now,
            expiresAt: input.expiresAt,
            certExpiresAt: input.certExpiresAt,
            quotaBytes: input.quotaBytes,
            quotaCycle: input.quotaCycle,
            quotaAnchor: now,
            usedBytes: 0,
            maxConcurrent: input.maxConcurrent,
            revoked: false,
            hold: null,
            note: input.note,
            staticIp: input.staticIp,
            passwordProtected: input.passwordProtected,
          };
          const event = makeEvent(
            now,
            row.name,
            "add",
            `Issued ${row.name}. On the server this is openvpn-install.sh client add.`,
          );
          return commit(
            state,
            { ...state, users: state.users.concat(row), events: [event, ...state.events] },
            now,
          );
        }),
      updateUser: (id, patch) =>
        set((state) => {
          const now = Date.now();
          const current = state.users.find((u) => u.id === id);
          if (!current) return state;
          const users = state.users.map((u) => (u.id === id ? { ...u, ...patch } : u));
          const event = makeEvent(now, current.name, "update", "Updated expiry, quota, or concurrent cap.");
          return commit(state, { ...state, users, events: [event, ...state.events] }, now);
        }),
      revokeUser: (id) =>
        set((state) => {
          const now = Date.now();
          const current = state.users.find((u) => u.id === id);
          if (!current || current.revoked) return state;
          const users = state.users.map((u) =>
            u.id === id ? { ...u, revoked: true, hold: "revoked" as const } : u,
          );
          const event = makeEvent(
            now,
            current.name,
            "revoke",
            `Revoked. On the server: ${state.server.hostname} → /root/openvpn-install.sh client revoke ${current.name}`,
          );
          return commit(
            state,
            {
              ...state,
              users,
              sessions: state.sessions.filter((s) => s.userId !== id),
              events: [event, ...state.events],
            },
            now,
          );
        }),
      reissueUser: (id) =>
        set((state) => {
          const now = Date.now();
          const current = state.users.find((u) => u.id === id);
          if (!current) return state;
          const certExpiresAt = now + 365 * 24 * 60 * 60 * 1000;
          const users = state.users.map((u) =>
            u.id === id ? { ...u, revoked: false, hold: null, certExpiresAt } : u,
          );
          const event = makeEvent(
            now,
            current.name,
            "reissue",
            `Reissued. On the server: /root/openvpn-install.sh client add ${current.name}`,
          );
          return commit(state, { ...state, users, events: [event, ...state.events] }, now);
        }),
      renewCert: (id) =>
        set((state) => {
          const now = Date.now();
          const current = state.users.find((u) => u.id === id);
          if (!current) return state;
          const base = Math.max(now, current.certExpiresAt);
          const certExpiresAt = base + 365 * 24 * 60 * 60 * 1000;
          const users = state.users.map((u) => (u.id === id ? { ...u, certExpiresAt } : u));
          const event = makeEvent(
            now,
            current.name,
            "renew",
            `Certificate extended 365 days. On the server: /root/openvpn-install.sh client renew ${current.name} --cert-days 365`,
          );
          return commit(state, { ...state, users, events: [event, ...state.events] }, now);
        }),
      resetUsage: (id) =>
        set((state) => {
          const now = Date.now();
          const current = state.users.find((u) => u.id === id);
          if (!current) return state;
          const users = state.users.map((u) =>
            u.id === id ? { ...u, usedBytes: 0, quotaAnchor: now, hold: u.hold === "quota" ? null : u.hold } : u,
          );
          const event = makeEvent(now, current.name, "reset-usage", "Usage counter reset to zero.");
          return commit(state, { ...state, users, events: [event, ...state.events] }, now);
        }),
      setServer: (patch) =>
        set((state) => {
          const now = Date.now();
          return commit(state, { ...state, server: { ...state.server, ...patch } }, now);
        }),
      resetDemo: () => set(createSeed(Date.now())),
      replayDemos: () =>
        set((state) => {
          const now = Date.now();
          const fixtures = replayFixtures(state.users, state.sessions, now);
          const event = makeEvent(
            now,
            "week-pass",
            "update",
            "Replayed the live demos: week-pass expires in 45s, pilot-phone has 4 MB of cap left.",
          );
          return commit(
            state,
            { ...state, ...fixtures, events: [event, ...state.events] },
            now,
          );
        }),
      importUsers: (users, serverPatch) =>
        set((state) => {
          const now = Date.now();
          const kept = new Set(users.map((u) => u.id));
          const event = makeEvent(now, "policy", "update", `Imported ${users.length} clients from clients.json.`);
          return commit(
            state,
            {
              ...state,
              users,
              server: { ...state.server, ...serverPatch },
              sessions: state.sessions.filter((s) => kept.has(s.userId)),
              events: [event, ...state.events],
            },
            now,
          );
        }),
    }),
    {
      name: "gatehouse.v1",
      skipHydration: true,
      partialize: (state) => ({
        seeded: state.seeded,
        users: state.users,
        sessions: state.sessions,
        events: state.events,
        samples: state.samples,
        server: state.server,
        now: state.now,
      }),
    },
  ),
);
