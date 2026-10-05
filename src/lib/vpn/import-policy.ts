import { z } from "zod";
import { ipInVpnSubnet, NAME_RE } from "@/lib/vpn/model";
import type { ServerProfile, VpnUser } from "@/lib/vpn/types";

const fileSchema = z.object({
  version: z.literal(1),
  server: z
    .object({
      concurrentPolicy: z.enum(["keep-newest", "keep-oldest"]).optional(),
      duplicateCn: z.boolean().optional(),
    })
    .optional(),
  clients: z.array(
    z.object({
      name: z.string().regex(NAME_RE),
      expiresAt: z.number().nullable().optional(),
      certExpiresAt: z.number(),
      quotaBytes: z.number().nullable().optional(),
      quotaCycle: z.enum(["none", "monthly"]).optional(),
      quotaAnchor: z.number().optional(),
      maxConcurrent: z.number().int().min(1).max(50),
      staticIp: z.string().optional(),
      revoked: z.boolean().optional(),
      note: z.string().optional(),
      passwordProtected: z.boolean().optional(),
    }),
  ),
});

export function parsePolicyFile(
  text: string,
  existing: VpnUser[],
  now: number,
): { users: VpnUser[]; serverPatch: Partial<ServerProfile> } {
  const parsed = fileSchema.parse(JSON.parse(text));
  const seen = new Set<string>();
  const ips = new Set<string>();
  const users = parsed.clients.map((row) => {
    if (seen.has(row.name)) throw new Error(`Duplicate client ${row.name}`);
    seen.add(row.name);
    const staticIp = (row.staticIp ?? "").trim();
    if (staticIp) {
      if (!ipInVpnSubnet(staticIp)) throw new Error(`${row.name}: static IP must be inside 10.8.0.0/24`);
      if (ips.has(staticIp)) throw new Error(`Static IP ${staticIp} is used twice`);
      ips.add(staticIp);
    }
    const prev = existing.find((u) => u.id === row.name);
    const user: VpnUser = {
      id: row.name,
      name: row.name,
      createdAt: prev?.createdAt ?? now,
      expiresAt: row.expiresAt ?? null,
      certExpiresAt: row.certExpiresAt,
      quotaBytes: row.quotaBytes ?? null,
      quotaCycle: row.quotaCycle ?? "none",
      quotaAnchor: row.quotaAnchor ?? prev?.quotaAnchor ?? now,
      usedBytes: prev?.usedBytes ?? 0,
      maxConcurrent: row.maxConcurrent,
      revoked: row.revoked ?? false,
      hold: null,
      note: row.note ?? "",
      staticIp,
      passwordProtected: row.passwordProtected ?? false,
    };
    return user;
  });
  const serverPatch: Partial<ServerProfile> = {};
  if (parsed.server?.concurrentPolicy) serverPatch.concurrentPolicy = parsed.server.concurrentPolicy;
  if (typeof parsed.server?.duplicateCn === "boolean") serverPatch.duplicateCn = parsed.server.duplicateCn;
  return { users, serverPatch };
}
