"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { useWallet } from "@/lib/wallet";
import {
  getEscrow,
  getProgress,
  buildReleaseArgs,
  buildCancelArgs,
  invokeContract,
} from "@/lib/soroban";
import { shortAddr, stroopsToXlm } from "@/lib/config";
import KeystoneArch from "@/components/KeystoneArch";
import ActivityFeed from "@/components/ActivityFeed";
import TxBanner, { TxState, isUserRejection, friendlyError } from "@/components/TxBanner";
import WalletNotFound from "@/components/errors/WalletNotFound";

function statusChip(status: string) {
  if (status === "Released")
    return "bg-oxide text-paper border-oxide";
  if (status === "Refunded")
    return "border-dashed border-ink-soft text-ink-soft";
  return "border-ink text-ink";
}

function EscrowDetail() {
  const params = useSearchParams();
  const id = Number(params.get("id") ?? "0");
  const { address, error, signTx, refreshBalance } = useWallet();
  const [tx, setTx] = useState<TxState>({ phase: "idle" });

  const { data: escrow, mutate: refetchEscrow } = useSWR(
    ["escrow", id],
    () => getEscrow(id),
    { refreshInterval: 5000 }
  );
  const { data: progress, mutate: refetchProgress } = useSWR(
    ["progress", id],
    () => getProgress(id),
    { refreshInterval: 5000 }
  );

  if (error === "wallet-not-found") return <WalletNotFound />;
  if (!escrow) {
    return <p className="mt-16 text-center text-ink-soft">Loading escrow №{id}…</p>;
  }

  const isClient = address === escrow.client;
  const total = escrow.milestones.reduce((s, m) => s + m.amount, 0n);
  const released = progress?.released ?? 0n;
  const locked = progress?.locked ?? total - released;
  const anyLocked = escrow.milestones.some((m) => m.status === "Locked");

  const run = async (
    label: string,
    build: () => { method: string; args: Parameters<typeof invokeContract>[2] }
  ) => {
    if (!address) return;
    setTx({ phase: "pending", label });
    try {
      const { method, args } = build();
      const hash = await invokeContract(address, method, args, signTx);
      setTx({ phase: "success", hash, label: `${label} confirmed` });
      await Promise.all([refetchEscrow(), refetchProgress(), refreshBalance()]);
    } catch (e) {
      if (isUserRejection(e)) setTx({ phase: "rejected" });
      else
        setTx({
          phase: "failed",
          message: friendlyError(e),
        });
    }
  };

  return (
    <section>
      <p className="annotation mb-2 text-center">
        plate iii — elevation, escrow №{id}
        {escrow.cancelled ? " (cancelled)" : ""}
      </p>

      {/* Hero */}
      <KeystoneArch milestones={escrow.milestones} />
      <div className="mt-2 text-center">
        <span className="font-display text-5xl font-semibold sm:text-6xl">
          {stroopsToXlm(released)}
        </span>
        <span className="font-display text-2xl"> XLM released</span>
        <div className="mt-1 text-ink-soft">
          <span className="font-display text-2xl">{stroopsToXlm(locked)}</span>{" "}
          XLM locked
        </div>
      </div>

      <div className="mx-auto mt-4 flex max-w-md justify-between annotation">
        <span>client {shortAddr(escrow.client)}</span>
        <span>freelancer {shortAddr(escrow.freelancer)}</span>
      </div>

      <div className="mx-auto mt-6 max-w-2xl">
        <TxBanner state={tx} onDismiss={() => setTx({ phase: "idle" })} />
      </div>

      {/* Milestones */}
      <div className="mx-auto mt-8 grid max-w-2xl gap-4">
        {escrow.milestones.map((m, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded border hairline bg-paper-deep p-5 sm:flex-row sm:items-center"
          >
            <div className="flex-1">
              <div className="annotation">stone {i + 1}</div>
              <div className="font-medium">{m.title}</div>
            </div>
            <div className="font-display text-xl font-semibold">
              {stroopsToXlm(m.amount)} XLM
            </div>
            <span
              className={`rounded border px-2.5 py-1 text-center text-xs ${statusChip(m.status)}`}
            >
              {m.status}
            </span>
            {isClient && m.status === "Locked" && !escrow.cancelled && (
              <button
                onClick={() =>
                  run(`Milestone ${i + 1} released`, () =>
                    buildReleaseArgs(id, i)
                  )
                }
                disabled={tx.phase === "pending"}
                className="min-h-11 rounded bg-oxide px-4 py-2 text-sm font-medium text-paper hover:bg-oxide-deep disabled:opacity-50"
              >
                Release
              </button>
            )}
          </div>
        ))}
      </div>

      {isClient && !escrow.cancelled && anyLocked && (
        <div className="mx-auto mt-6 max-w-2xl text-right">
          <button
            onClick={() => run("Escrow cancelled", () => buildCancelArgs(id))}
            disabled={tx.phase === "pending"}
            className="min-h-11 rounded border border-oxide px-4 py-2 text-sm font-medium text-oxide hover:bg-oxide hover:text-paper disabled:opacity-50"
          >
            Cancel escrow & refund locked funds
          </button>
        </div>
      )}

      {/* Live activity */}
      <div className="mx-auto mt-12 max-w-2xl">
        <ActivityFeed escrowId={id} />
      </div>
    </section>
  );
}

export default function EscrowPage() {
  return (
    <Suspense
      fallback={<p className="mt-16 text-center text-ink-soft">Loading…</p>}
    >
      <EscrowDetail />
    </Suspense>
  );
}
