import { HOST_PATHS } from "@/lib/vpn/seed";
import type { ServerProfile, VpnUser } from "@/lib/vpn/types";

export function addCommand(server: ServerProfile, name: string, certDays: number, password: boolean): string {
  const parts = [HOST_PATHS.install, "client", "add", name, "--client-cert-days", String(certDays)];
  if (password) parts.push("--password");
  return parts.join(" ");
}

export function revokeCommand(name: string): string {
  return `${HOST_PATHS.install} client revoke ${name}`;
}

export function renewCommand(name: string): string {
  return `${HOST_PATHS.install} client renew ${name} --cert-days 365`;
}

export function policyDocument(
  server: ServerProfile,
  users: VpnUser[],
): Record<string, unknown> {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    note: "Policy for gatehouse-agent.py. The agent keeps its own usage counters in /var/lib/gatehouse/state.json — do not put usedBytes here.",
    server: {
      concurrentPolicy: server.concurrentPolicy,
      duplicateCn: server.duplicateCn,
      subnet: server.subnet,
      netmask: server.netmask,
    },
    clients: users.map((u) => ({
      name: u.name,
      expiresAt: u.expiresAt,
      certExpiresAt: u.certExpiresAt,
      quotaBytes: u.quotaBytes,
      quotaCycle: u.quotaCycle,
      quotaAnchor: u.quotaAnchor,
      maxConcurrent: u.maxConcurrent,
      staticIp: u.staticIp,
      revoked: u.revoked,
      note: u.note,
      passwordProtected: u.passwordProtected,
    })),
  };
}

export function ovpnProfile(server: ServerProfile, user: VpnUser): string {
  const lines = [
    "# Gatehouse demo profile — NOT a live certificate.",
    `# Real file on the server: /root/${user.name}.ovpn`,
    `# Produced by: ${addCommand(server, user.name, 3650, user.passwordProtected)}`,
    "# The blocks below are markers. openvpn-install.sh replaces them with CA, cert, key, and tls-crypt-v2.",
    "client",
    `proto ${server.protocol}`,
    server.protocol === "udp" ? "explicit-exit-notify" : null,
    `remote ${server.publicIp} ${server.port}`,
    "dev tun",
    "resolv-retry infinite",
    "nobind",
    "persist-key",
    "persist-tun",
    "remote-cert-tls server",
    "verify-x509-name server name",
    "auth SHA256",
    "auth-nocache",
    `cipher ${server.cipher}`,
    "ignore-unknown-option data-ciphers",
    `data-ciphers ${server.cipher}`,
    "tls-client",
    "tls-version-min 1.2",
    "verb 3",
    "",
    "<ca>",
    "# DEMO — easy-rsa CA from the OpenVPN host",
    "DEMO-CA",
    "</ca>",
    "<cert>",
    `# DEMO — certificate CN=${user.name}`,
    "DEMO-CERT",
    "</cert>",
    "<key>",
    user.passwordProtected ? "# DEMO — private key is password protected" : "# DEMO — private key",
    "DEMO-KEY",
    "</key>",
    server.tlsCrypt ? "<tls-crypt-v2>\nDEMO-TLS-CRYPT-V2\n</tls-crypt-v2>" : null,
    "",
  ];
  return lines.filter((line) => line != null).join("\n");
}

export const SYSTEMD_SERVICE = `[Unit]
Description=Gatehouse OpenVPN policy agent
After=network-online.target openvpn-server@server.service

[Service]
Type=oneshot
ExecStart=/usr/bin/python3 /usr/local/sbin/gatehouse-agent.py --once
`;

export const SYSTEMD_TIMER = `[Unit]
Description=Run Gatehouse agent every minute

[Timer]
OnBootSec=30
OnUnitActiveSec=60
AccuracySec=10
Persistent=true

[Install]
WantedBy=timers.target
`;

export function downloadText(filename: string, text: string, type = "text/plain"): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
