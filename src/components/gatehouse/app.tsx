import { useEffect, useState } from "react";
import { LiveApi } from "@/components/gatehouse/api";
import { Console } from "@/components/gatehouse/console";
import { createSeed } from "@/lib/vpn/seed";
import { useVpn } from "@/lib/vpn/store";

export function GatehouseApp() {
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    const boot = async () => {
      try {
        await useVpn.persist.rehydrate();
      } catch {
        /* first visit has no saved policy */
      }
      if (cancelled) return;
      if (!useVpn.getState().seeded) {
        useVpn.setState(createSeed(Date.now()));
      }
      useVpn.getState().tick(Date.now());
      timer = window.setInterval(() => useVpn.getState().tick(Date.now()), 1000);
      setBooted(true);
    };
    void boot();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (!booted) return <Console />;
  return (
    <LiveApi>
      <Console />
    </LiveApi>
  );
}
