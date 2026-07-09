"use client";

import Link from "next/link";
import useSWR from "swr";
import { useWallet } from "@/lib/wallet";
import { listEscrowsFor } from "@/lib/soroban";
import { shortAddr, stroopsToXlm } from "@/lib/config";
import WalletNotFound from "@/components/errors/WalletNotFound";

export default function Home() {
  const { address, error, connect } = useWallet();

  const { data: escrows, isLoading } = useSWR(
    address ? ["escrows", address] : null,
    () => listEscrowsFor(address as string),
    { refreshInterval: 10_000 }
  );

  if (error === "wallet-not-found") return <WalletNotFound />;

  if (!address) {
    return (
      <section className="mt-16 text-center">
        <p className="annotation mb-4">plate i — site survey</p>
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">
          Payments, set in stone.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-ink-soft">
          Keystone locks a project&apos;s budget into on-chain escrow, split
          across milestones. The client releases each stone as work lands; the
          freelancer gets paid the moment it&apos;s approved.
        </p>
        <button
          onClick={connect}
          className="mt-8 rounded bg-oxide px-6 py-3 font-medium text-paper hover:bg-oxide-deep"
        >
          Connect wallet to begin
        </button>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="font-display text-3xl font-semibold">Your escrows</h1>
        <span className="annotation">as {shortAddr(address)}</span>
      </div>

      {isLoading && <p className="text-ink-soft">Surveying the chain…</p>}

      {escrows && escrows.length === 0 && (
        <div className="rounded border hairline bg-paper-deep p-8 text-center">
          <p className="text-ink-soft">No escrows involve this address yet.</p>
          <Link
            href="/create"
            className="mt-4 inline-block rounded bg-oxide px-5 py-2.5 font-medium text-paper hover:bg-oxide-deep"
          >
            Create the first one
          </Link>
        </div>
      )}

      <ul className="grid gap-4 sm:grid-cols-2">
        {escrows?.map((e) => {
          const total = e.milestones.reduce((s, m) => s + m.amount, 0n);
          const released = e.milestones
            .filter((m) => m.status === "Released")
            .reduce((s, m) => s + m.amount, 0n);
          const role = e.client === address ? "client" : "freelancer";
          return (
            <li key={e.id}>
              <Link
                href={`/escrow/?id=${e.id}`}
                className="block rounded border hairline bg-paper-deep p-5 hover:border-oxide"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-xl font-semibold">
                    Escrow №{e.id}
                  </span>
                  <span className="annotation">{role}</span>
                </div>
                <p className="mt-2 text-sm text-ink-soft">
                  {stroopsToXlm(released)} / {stroopsToXlm(total)} XLM released
                  · {e.milestones.length} milestones
                  {e.cancelled ? " · cancelled" : ""}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
