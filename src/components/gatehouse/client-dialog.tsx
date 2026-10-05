import * as Dialog from "@radix-ui/react-dialog";
import * as Switch from "@radix-ui/react-switch";
import { X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApi } from "@/components/gatehouse/api";
import { controlClass } from "@/components/gatehouse/bits";
import { bytesToGbInput, formatDay, fromDateInput, GB_BYTES, toDateInput } from "@/lib/vpn/format";
import { addCommand, downloadText, ovpnProfile, renewCommand } from "@/lib/vpn/files";
import { ipInVpnSubnet, NAME_RE } from "@/lib/vpn/model";
import { type NewUserInput, type UserPatch } from "@/lib/vpn/store";

export function ClientDialog({
  mode,
  userId,
  onClose,
}: {
  mode: "new" | "edit";
  userId?: string;
  onClose: () => void;
}) {
  const api = useApi();
  const user = api.users.find((u) => u.id === userId);
  const { users, server, addUser, updateUser, renewCert, now } = api;

  const [name, setName] = useState(user?.name ?? "");
  const [noDate, setNoDate] = useState(user ? user.expiresAt == null : false);
  const [date, setDate] = useState(
    user?.expiresAt != null ? toDateInput(user.expiresAt) : toDateInput(now + 90 * 24 * 60 * 60 * 1000),
  );
  const [certDays, setCertDays] = useState("3650");
  const [unlimited, setUnlimited] = useState(user ? user.quotaBytes == null : false);
  const [quotaGb, setQuotaGb] = useState(user?.quotaBytes != null ? bytesToGbInput(user.quotaBytes) : "20");
  const [cycle, setCycle] = useState<"none" | "monthly">(user?.quotaCycle ?? "none");
  const [maxConcurrent, setMaxConcurrent] = useState(String(user?.maxConcurrent ?? 1));
  const [staticIp, setStaticIp] = useState(user?.staticIp ?? "");
  const [note, setNote] = useState(user?.note ?? "");
  const [password, setPassword] = useState(user?.passwordProtected ?? false);
  const [error, setError] = useState("");

  const capWarning = !server.duplicateCn && Number(maxConcurrent) > 1;

  function save() {
    const concurrent = Number(maxConcurrent);
    const quota = unlimited ? null : Math.round(Number(quotaGb) * GB_BYTES);
    const expiresAt = noDate ? null : fromDateInput(date);
    const ip = staticIp.trim();
    if (mode === "new" && !NAME_RE.test(name)) {
      setError("Name must start with a letter or digit and use only letters, digits, dot, underscore, hyphen.");
      return;
    }
    if (mode === "new" && users.some((u) => u.name === name)) {
      setError("That common name already exists.");
      return;
    }
    if (!noDate && expiresAt == null) {
      setError("Pick a policy expiry date, or mark it unlimited.");
      return;
    }
    if (!unlimited && (!Number.isFinite(quota) || (quota ?? 0) <= 0)) {
      setError("Data cap must be a positive number of gigabytes.");
      return;
    }
    if (!Number.isInteger(concurrent) || concurrent < 1 || concurrent > 20) {
      setError("Concurrent sessions must be a whole number from 1 to 20.");
      return;
    }
    if (ip && !ipInVpnSubnet(ip)) {
      setError("Static IP must be inside 10.8.0.2–10.8.0.254 (topology subnet).");
      return;
    }
    if (ip && users.some((u) => u.staticIp === ip && u.id !== userId)) {
      setError("That static IP is already assigned.");
      return;
    }
    const days = Number(certDays);
    if (mode === "new" && (!Number.isInteger(days) || days < 1 || days > 3650)) {
      setError("Certificate lifetime must be 1–3650 days (Easy-RSA default is 3650).");
      return;
    }

    const shared: UserPatch = {
      expiresAt,
      certExpiresAt: mode === "new" ? Date.now() + days * 24 * 60 * 60 * 1000 : (user?.certExpiresAt ?? Date.now()),
      quotaBytes: quota,
      quotaCycle: unlimited ? "none" : cycle,
      maxConcurrent: concurrent,
      note: note.trim(),
      staticIp: ip,
      passwordProtected: password,
    };

    if (mode === "new") {
      const input: NewUserInput = { name, ...shared };
      addUser(input);
      toast.success(`Issued ${name}`);
    } else if (user) {
      updateUser(user.id, shared);
      toast.success(`Updated ${user.name}`);
    }
    onClose();
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-bg/70" />
        <Dialog.Content className="fixed inset-x-3 top-4 z-50 max-h-[85vh] overflow-y-auto rounded-lg bg-surface p-5 shadow-pop outline-none md:left-1/2 md:w-full md:max-w-lg md:-translate-x-1/2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-lg font-semibold">
                {mode === "new" ? "Issue client" : user?.name}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted">
                {mode === "new"
                  ? "Same identity openvpn-install.sh uses as the certificate common name."
                  : "Limits apply on the next agent pass. The certificate name stays put."}
              </Dialog.Description>
            </div>
            <Dialog.Close className="flex size-11 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-fg" aria-label="Close">
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <form
            className="mt-5 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            {mode === "new" ? (
              <label className="grid gap-1.5 text-sm font-medium">
                Common name
                <input className={controlClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" spellCheck={false} />
              </label>
            ) : user ? (
              <p className="text-sm text-muted">
                Certificate ends {formatDay(user.certExpiresAt)}. Policy date{" "}
                {user.expiresAt ? formatDay(user.expiresAt) : "is not set"}.
              </p>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">No policy date</span>
              <Switch.Root
                checked={noDate}
                onCheckedChange={setNoDate}
                className="relative h-6 w-11 rounded-full bg-surface-2 data-[state=checked]:bg-primary"
                aria-label="No policy date"
              >
                <Switch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-fg transition-transform data-[state=checked]:translate-x-5 data-[state=checked]:bg-primary-fg" />
              </Switch.Root>
            </div>
            {!noDate ? (
              <label className="grid gap-1.5 text-sm font-medium">
                Access ends
                <input className={controlClass} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
            ) : (
              <p className="text-sm text-muted">Access still ends when the certificate expires. Renew it before then.</p>
            )}

            {mode === "new" ? (
              <label className="grid gap-1.5 text-sm font-medium">
                Certificate lifetime (days)
                <input className={controlClass} inputMode="numeric" value={certDays} onChange={(e) => setCertDays(e.target.value)} />
              </label>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">Unlimited data</span>
              <Switch.Root
                checked={unlimited}
                onCheckedChange={setUnlimited}
                className="relative h-6 w-11 rounded-full bg-surface-2 data-[state=checked]:bg-primary"
                aria-label="Unlimited data"
              >
                <Switch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-fg transition-transform data-[state=checked]:translate-x-5 data-[state=checked]:bg-primary-fg" />
              </Switch.Root>
            </div>
            {!unlimited ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium">
                  Data cap (GB)
                  <input className={controlClass} inputMode="decimal" value={quotaGb} onChange={(e) => setQuotaGb(e.target.value)} />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Cycle
                  <select className={controlClass} value={cycle} onChange={(e) => setCycle(e.target.value as "none" | "monthly")}>
                    <option value="none">Until raised or reset</option>
                    <option value="monthly">Reset every 30 days</option>
                  </select>
                </label>
              </div>
            ) : null}

            <label className="grid gap-1.5 text-sm font-medium">
              Concurrent sessions
              <input className={controlClass} inputMode="numeric" value={maxConcurrent} onChange={(e) => setMaxConcurrent(e.target.value)} />
            </label>
            {capWarning ? (
              <p className="text-sm text-primary">
                This host has duplicate-cn off, so OpenVPN will only keep one session. Turn it on under Agent before a cap above 1 can stick.
              </p>
            ) : (
              <p className="text-sm text-muted">
                Above 1 needs duplicate-cn. Keep-newest drops the oldest login; keep-oldest refuses the new one.
              </p>
            )}

            <label className="grid gap-1.5 text-sm font-medium">
              Static VPN address
              <input className={controlClass} value={staticIp} placeholder="10.8.0.20" onChange={(e) => setStaticIp(e.target.value)} spellCheck={false} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Note
              <input className={controlClass} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">
                <span className="font-medium">Password on the private key</span>
                <span className="mt-0.5 block text-muted">Passed as --password. The secret is not stored here.</span>
              </span>
              <Switch.Root
                checked={password}
                onCheckedChange={setPassword}
                className="relative h-6 w-11 shrink-0 rounded-full bg-surface-2 data-[state=checked]:bg-primary"
                aria-label="Password protected key"
              >
                <Switch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-fg transition-transform data-[state=checked]:translate-x-5 data-[state=checked]:bg-primary-fg" />
              </Switch.Root>
            </div>

            {error ? <p className="text-sm text-danger">{error}</p> : null}

            {mode === "new" ? (
              <p className="break-all rounded-md bg-bg px-3 py-2 font-mono text-xs text-muted">
                {addCommand(server, name || "name", Number(certDays) || 3650, password)}
              </p>
            ) : user ? (
              <div className="grid gap-2">
                <p className="break-all rounded-md bg-bg px-3 py-2 font-mono text-xs text-muted">{renewCommand(user.name)}</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      renewCert(user.id);
                      toast.success(`Renewed ${user.name}`);
                    }}
                  >
                    Renew +365 days
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => downloadText(`${user.name}.ovpn`, ovpnProfile(server, user))}
                  >
                    Demo profile
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="submit">{mode === "new" ? "Issue client" : "Save limits"}</Button>
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
