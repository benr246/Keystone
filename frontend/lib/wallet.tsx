"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { StellarWalletsKit as KitType } from "@creit.tech/stellar-wallets-kit";
import { HORIZON_URL, NETWORK_PASSPHRASE } from "./config";

// The wallet kit touches browser globals at import time, so it must be
// loaded lazily on the client — never during static prerender.
async function loadKit(): Promise<typeof KitType> {
  const [kit, utils, freighter] = await Promise.all([
    import("@creit.tech/stellar-wallets-kit"),
    import("@creit.tech/stellar-wallets-kit/modules/utils"),
    import("@creit.tech/stellar-wallets-kit/modules/freighter"),
  ]);
  if (!kitInitialized) {
    kit.StellarWalletsKit.init({
      network: kit.Networks.TESTNET,
      selectedWalletId: freighter.FREIGHTER_ID,
      modules: utils.defaultModules(),
    });
    kitInitialized = true;
  }
  return kit.StellarWalletsKit;
}
let kitInitialized = false;

type WalletState = {
  address: string | null;
  balance: string | null;
  connecting: boolean;
  error: "wallet-not-found" | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  signTx: (xdrBase64: string) => Promise<string>;
  refreshBalance: () => Promise<void>;
};

const WalletContext = createContext<WalletState | null>(null);

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet outside WalletProvider");
  return ctx;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<"wallet-not-found" | null>(null);

  const fetchBalance = useCallback(async (addr: string) => {
    try {
      const res = await fetch(`${HORIZON_URL}/accounts/${addr}`);
      if (!res.ok) {
        setBalance("0");
        return;
      }
      const json = await res.json();
      const native = json.balances?.find(
        (b: { asset_type: string }) => b.asset_type === "native"
      );
      setBalance(native ? native.balance : "0");
    } catch {
      setBalance(null);
    }
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      const kit = await loadKit();
      const { address: addr } = await kit.authModal();
      setAddress(addr);
      localStorage.setItem("keystone:connected", "1");
      await fetchBalance(addr);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (/not (installed|available|found)/i.test(message)) {
        setError("wallet-not-found");
      }
    } finally {
      setConnecting(false);
    }
  }, [fetchBalance]);

  const disconnect = useCallback(() => {
    loadKit()
      .then((kit) => kit.disconnect())
      .catch(() => {});
    setAddress(null);
    setBalance(null);
    localStorage.removeItem("keystone:connected");
  }, []);

  const signTx = useCallback(
    async (xdrBase64: string) => {
      const kit = await loadKit();
      const { signedTxXdr } = await kit.signTransaction(xdrBase64, {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: address ?? undefined,
      });
      return signedTxXdr;
    },
    [address]
  );

  const refreshBalance = useCallback(async () => {
    if (address) await fetchBalance(address);
  }, [address, fetchBalance]);

  // Restore prior session silently.
  useEffect(() => {
    if (!localStorage.getItem("keystone:connected")) return;
    (async () => {
      try {
        const kit = await loadKit();
        const { address: addr } = await kit.getAddress();
        if (addr) {
          setAddress(addr);
          await fetchBalance(addr);
        }
      } catch {
        localStorage.removeItem("keystone:connected");
      }
    })();
  }, [fetchBalance]);

  return (
    <WalletContext.Provider
      value={{
        address,
        balance,
        connecting,
        error,
        connect,
        disconnect,
        signTx,
        refreshBalance,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}
