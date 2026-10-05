export type Access = "active" | "expired" | "quota" | "revoked";

export type EventKind =
  | "block-expiry"
  | "block-quota"
  | "block-revoked"
  | "kill-concurrent"
  | "enable"
  | "quota-reset"
  | "add"
  | "revoke"
  | "reissue"
  | "renew"
  | "connect"
  | "disconnect"
  | "refused"
  | "update"
  | "reset-usage";

export type Hold = "expired" | "quota" | "revoked" | null;

export interface VpnUser {
  id: string;
  name: string;
  createdAt: number;
  /** Policy date. Null means no calendar limit. Access still ends at certExpiresAt. */
  expiresAt: number | null;
  certExpiresAt: number;
  /** Null means unlimited. Counts upload + download. */
  quotaBytes: number | null;
  quotaCycle: "none" | "monthly";
  quotaAnchor: number;
  usedBytes: number;
  /** Enforced only when the server has duplicate-cn. Otherwise OpenVPN allows one session. */
  maxConcurrent: number;
  revoked: boolean;
  hold: Hold;
  note: string;
  staticIp: string;
  passwordProtected: boolean;
}

export interface Session {
  id: string;
  userId: string;
  realAddress: string;
  virtualAddress: string;
  connectedAt: number;
  bytesIn: number;
  bytesOut: number;
  /** Bytes per second from the client (upload). */
  rateIn: number;
  /** Bytes per second to the client (download). */
  rateOut: number;
}

export interface EnforceEvent {
  id: string;
  at: number;
  userName: string;
  kind: EventKind;
  detail: string;
}

export interface Sample {
  t: number;
  bps: number;
}

export interface ServerProfile {
  hostname: string;
  publicIp: string;
  port: number;
  protocol: "udp" | "tcp";
  subnet: string;
  netmask: string;
  dns: string;
  cipher: string;
  authMode: "pki" | "fingerprint";
  duplicateCn: boolean;
  concurrentPolicy: "keep-newest" | "keep-oldest";
  tlsCrypt: boolean;
}

export interface Snap {
  seeded: boolean;
  users: VpnUser[];
  sessions: Session[];
  events: EnforceEvent[];
  samples: Sample[];
  server: ServerProfile;
  now: number;
}
