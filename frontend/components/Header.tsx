"use client";

import Link from "next/link";
import { useWallet } from "@/lib/wallet";
import { shortAddr } from "@/lib/config";

export default function Header() {
  const { address, balance, connecting, connect, disconnect } = useWallet();

  return (
    <header className="border-b hairline bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-semibold tracking-tight">
            Keystone
          </span>
          <span className="annotation hidden sm:inline">
            milestone escrow / fig. 1
          </span>
        </Link>
        <nav className="ml-auto flex items-center gap-3">
          <Link
            href="/create"
            className="annotation flex min-h-11 items-center rounded border hairline px-3 hover:border-oxide hover:text-oxide"
          >
            + New escrow
          </Link>
          {address ? (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="font-mono text-xs">{shortAddr(address)}</div>
                <div className="annotation">
                  {balance !== null ? `${balance} XLM` : "balance…"}
                </div>
              </div>
              <button
                onClick={disconnect}
                className="annotation min-h-11 rounded border hairline px-3 hover:border-oxide hover:text-oxide"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={connect}
              disabled={connecting}
              className="min-h-11 rounded bg-oxide px-4 text-sm font-medium text-paper hover:bg-oxide-deep disabled:opacity-60"
            >
              {connecting ? "Connecting…" : "Connect wallet"}
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
