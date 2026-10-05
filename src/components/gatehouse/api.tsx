import { createContext, useContext, type ReactNode } from "react";
import { INITIAL_SNAP } from "@/lib/vpn/seed";
import { useVpn } from "@/lib/vpn/store";

type Api = ReturnType<typeof useVpn.getState>;

const frozen: Api = {
  ...INITIAL_SNAP,
  tick: () => {},
  connect: () => ({ ok: false, message: "" }),
  killSession: () => {},
  disconnectUser: () => {},
  addUser: () => {},
  updateUser: () => {},
  revokeUser: () => {},
  reissueUser: () => {},
  renewCert: () => {},
  resetUsage: () => {},
  setServer: () => {},
  resetDemo: () => {},
  replayDemos: () => {},
  importUsers: () => {},
};

const ApiContext = createContext<Api>(frozen);

export function useApi(): Api {
  return useContext(ApiContext);
}

export function LiveApi({ children }: { children: ReactNode }) {
  const api = useVpn();
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}
