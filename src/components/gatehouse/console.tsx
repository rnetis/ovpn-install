import { Activity, FileText, Shield, Users } from "lucide-react";
import { useState } from "react";
import { Toaster } from "sonner";
import { AgentView } from "@/components/gatehouse/agent-view";
import { ClientDialog } from "@/components/gatehouse/client-dialog";
import { Clients } from "@/components/gatehouse/clients";
import { Overview } from "@/components/gatehouse/overview";
import { Sessions } from "@/components/gatehouse/sessions";
import { useApi } from "@/components/gatehouse/api";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/vpn/format";

type View = "overview" | "clients" | "sessions" | "agent";

const TABS: { id: View; label: string; icon: typeof Shield }[] = [
  { id: "overview", label: "Overview", icon: Shield },
  { id: "clients", label: "Clients", icon: Users },
  { id: "sessions", label: "Live", icon: Activity },
  { id: "agent", label: "Agent", icon: FileText },
];

export function Console() {
  const [view, setView] = useState<View>("overview");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<null | "new" | string>(null);
  const api = useApi();
  const { server, sessions, samples } = api;
  const bps = samples.at(-1)?.bps ?? 0;

  return (
    <div className="min-h-screen md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="border-b border-border bg-bg md:min-h-screen md:border-r md:border-b-0">
        <div className="flex items-center gap-3 px-4 py-4 md:px-4">
          <span className="flex size-11 items-center justify-center rounded-md bg-primary text-primary-fg">
            <Shield className="size-5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-semibold leading-tight">Gatehouse</span>
            <span className="block truncate font-mono text-xs text-muted">
              {server.hostname} · {server.protocol}/{server.port}
            </span>
          </span>
        </div>
        <nav className="grid grid-cols-4 gap-1 px-3 pb-3 md:flex md:flex-col md:px-3" aria-label="Sections">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = view === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setView(tab.id)}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 rounded-md text-xs md:h-11 md:flex-row md:justify-start md:gap-2 md:px-3 md:text-sm",
                  active ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface hover:text-fg",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-6">
          <p className="min-w-0 truncate text-sm text-muted">
            Simulated host · {sessions.length} live ·{" "}
            <span className="tabular-nums text-fg">{formatBytes(bps)}/s</span>
          </p>
          <p className="hidden text-xs text-muted sm:block">per-user date, data, and session caps</p>
        </header>
        <main className="px-4 py-4 md:px-6 md:py-6">
          {view === "overview" ? (
            <Overview
              onOpenUser={(name) => {
                setQuery(name);
                setView("clients");
              }}
            />
          ) : null}
          {view === "clients" ? (
            <Clients
              query={query}
              onQuery={setQuery}
              onCreate={() => setEditing("new")}
              onEdit={(id) => setEditing(id)}
            />
          ) : null}
          {view === "sessions" ? <Sessions /> : null}
          {view === "agent" ? <AgentView /> : null}
        </main>
      </div>

      {editing === "new" ? <ClientDialog mode="new" onClose={() => setEditing(null)} /> : null}
      {editing && editing !== "new" ? (
        <ClientDialog key={editing} mode="edit" userId={editing} onClose={() => setEditing(null)} />
      ) : null}
      <Toaster
        theme="dark"
        position="top-center"
        toastOptions={{ className: "bg-surface text-fg border border-border" }}
      />
    </div>
  );
}
