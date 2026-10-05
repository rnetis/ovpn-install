import * as Switch from "@radix-ui/react-switch";
import { formatDistance } from "date-fns";
import { useRef } from "react";
import { toast } from "sonner";
import agentSource from "@/lib/vpn/gatehouse-agent.py?raw";
import { useApi } from "@/components/gatehouse/api";
import { controlClass } from "@/components/gatehouse/bits";
import { Button } from "@/components/ui/button";
import {
  downloadText,
  policyDocument,
  SYSTEMD_SERVICE,
  SYSTEMD_TIMER,
} from "@/lib/vpn/files";
import { HOST_PATHS } from "@/lib/vpn/seed";
import { parsePolicyFile } from "@/lib/vpn/import-policy";

export function AgentView() {
  const { server, users, events, now, setServer, resetDemo, importUsers } = useApi();
  const fileRef = useRef<HTMLInputElement>(null);
  const overOne = users.filter((u) => u.maxConcurrent > 1).length;

  function exportPolicy() {
    const body = JSON.stringify(policyDocument(server, users), null, 2);
    downloadText("clients.json", body, "application/json");
    toast.success("Exported clients.json");
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-lg bg-surface p-4 shadow-card">
        <h2 className="text-sm font-semibold">This preview is the control plane</h2>
        <p className="mt-2 text-sm text-muted">
          Gatehouse follows the same client names{" "}
          <a
            className="text-primary underline decoration-primary/40 underline-offset-2"
            href="https://github.com/angristan/openvpn-install"
            target="_blank"
            rel="noreferrer"
          >
            angristan/openvpn-install
          </a>{" "}
          puts on certificates. The preview simulates <span className="font-mono text-xs">status.log</span> so you can
          watch a data cap and a date expiry fire. On the VPS, export the policy and run the agent beside the install
          script — this page does not open a shell on your server.
        </p>
      </section>

      <section className="grid gap-4 rounded-lg bg-surface p-4 shadow-card">
        <h2 className="text-sm font-semibold">Host profile</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium">
            Hostname
            <input className={controlClass} value={server.hostname} onChange={(e) => setServer({ hostname: e.target.value })} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Public address
            <input className={controlClass} value={server.publicIp} onChange={(e) => setServer({ publicIp: e.target.value })} spellCheck={false} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Port
            <input
              className={controlClass}
              inputMode="numeric"
              value={String(server.port)}
              onChange={(e) => {
                const port = Number(e.target.value);
                if (Number.isInteger(port) && port > 0 && port < 65536) setServer({ port });
              }}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Protocol
            <select
              className={controlClass}
              value={server.protocol}
              onChange={(e) => setServer({ protocol: e.target.value as "udp" | "tcp" })}
            >
              <option value="udp">udp</option>
              <option value="tcp">tcp</option>
            </select>
          </label>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">
            <span className="font-medium">duplicate-cn</span>
            <span className="mt-0.5 block text-muted">
              {overOne} client{overOne === 1 ? "" : "s"} allow more than one session. Angristan leaves this off.
            </span>
          </span>
          <Switch.Root
            checked={server.duplicateCn}
            onCheckedChange={(duplicateCn) => setServer({ duplicateCn })}
            className="relative h-6 w-11 shrink-0 rounded-full bg-surface-2 data-[state=checked]:bg-primary"
            aria-label="duplicate-cn"
          >
            <Switch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-fg transition-transform data-[state=checked]:translate-x-5 data-[state=checked]:bg-primary-fg" />
          </Switch.Root>
        </div>
        <p className="whitespace-pre-wrap break-all rounded-md bg-bg px-3 py-2 font-mono text-xs text-muted">
          {server.duplicateCn
            ? `# ${HOST_PATHS.conf}\nduplicate-cn\nsystemctl restart ${HOST_PATHS.unit}`
            : `# ${HOST_PATHS.conf}\n# duplicate-cn is not set — one session per certificate`}
        </p>
        <label className="grid gap-1.5 text-sm font-medium">
          When a client is over their cap
          <select
            className={controlClass}
            value={server.concurrentPolicy}
            onChange={(e) => setServer({ concurrentPolicy: e.target.value as "keep-newest" | "keep-oldest" })}
          >
            <option value="keep-newest">Keep newest — drop the oldest tunnel</option>
            <option value="keep-oldest">Keep oldest — refuse the new login</option>
          </select>
        </label>
        <p className="text-xs text-muted">
          {server.subnet} · {server.cipher} · DNS {server.dns} · {server.authMode} · tls-crypt-v2
        </p>
      </section>

      <section className="grid gap-3 rounded-lg bg-surface p-4 shadow-card">
        <h2 className="text-sm font-semibold">Drop on the server</h2>
        <ol className="grid list-decimal gap-2 pl-5 text-sm text-muted">
          <li>Install OpenVPN with openvpn-install.sh. Leave client add / revoke / renew to that script.</li>
          <li>
            Copy <span className="font-mono text-xs">gatehouse-agent.py</span> to {HOST_PATHS.agent}. It only needs Python 3.
          </li>
          <li>
            Export <span className="font-mono text-xs">clients.json</span> to {HOST_PATHS.policy}. Re-export when limits change.
          </li>
          <li>
            If anyone has a cap above 1, add <span className="font-mono text-xs">duplicate-cn</span> and restart {HOST_PATHS.unit}.
          </li>
          <li>Enable the timer. Each pass reads the status log, adds new bytes to the quota, writes CCD, and kills extra or blocked sessions. The first time a live session is seen, the bytes already in the status file count.</li>
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => downloadText("gatehouse-agent.py", agentSource)}>
            Download agent
          </Button>
          <Button type="button" variant="outline" onClick={exportPolicy}>
            Export clients.json
          </Button>
          <Button type="button" variant="outline" onClick={() => downloadText("gatehouse-agent.service", SYSTEMD_SERVICE)}>
            service
          </Button>
          <Button type="button" variant="outline" onClick={() => downloadText("gatehouse-agent.timer", SYSTEMD_TIMER)}>
            timer
          </Button>
          <Button type="button" variant="ghost" onClick={() => fileRef.current?.click()}>
            Import JSON
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              try {
                const parsed = parsePolicyFile(await file.text(), users, Date.now());
                importUsers(parsed.users, parsed.serverPatch);
                toast.success(`Imported ${parsed.users.length} clients`);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not import that file");
              }
            }}
          />
        </div>
        <p className="break-all font-mono text-xs text-muted">
          python3 {HOST_PATHS.agent} --once --dry-run
        </p>
      </section>

      <section className="rounded-lg bg-surface p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Enforcement log</h2>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              resetDemo();
              toast("Demo host restored");
            }}
          >
            Reset demo
          </Button>
        </div>
        <ul className="grid gap-3">
          {events.map((event) => (
            <li key={event.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm font-medium">
                  {event.userName}
                  <span className="ml-2 font-normal text-muted">{event.kind}</span>
                </span>
                <span className="shrink-0 text-xs text-muted tabular-nums">
                  {formatDistance(event.at, now, { addSuffix: true })}
                </span>
              </div>
              <p className="text-sm text-muted">{event.detail}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
