"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet";
import {
  buildCreateEscrowArgs,
  invokeContract,
  getEscrowCount,
} from "@/lib/soroban";
import { TOKEN_CONTRACT, xlmToStroops } from "@/lib/config";
import TxBanner, { TxState, isUserRejection } from "@/components/TxBanner";
import WalletNotFound from "@/components/errors/WalletNotFound";

type Row = { title: string; amount: string };

const FEE_HEADROOM_XLM = 2; // keep a little XLM for fees + reserves

export default function CreateEscrow() {
  const router = useRouter();
  const { address, balance, error, connect, signTx, refreshBalance } =
    useWallet();

  const [freelancer, setFreelancer] = useState("");
  const [rows, setRows] = useState<Row[]>([
    { title: "", amount: "" },
    { title: "", amount: "" },
  ]);
  const [tx, setTx] = useState<TxState>({ phase: "idle" });
  const [shortfall, setShortfall] = useState<string | null>(null);

  const total = useMemo(
    () =>
      rows.reduce((sum, r) => {
        const n = parseFloat(r.amount);
        return sum + (isNaN(n) ? 0 : n);
      }, 0),
    [rows]
  );

  if (error === "wallet-not-found") return <WalletNotFound />;

  if (!address) {
    return (
      <div className="mt-16 text-center">
        <p className="text-ink-soft">Connect a wallet to draft an escrow.</p>
        <button
          onClick={connect}
          className="mt-4 rounded bg-oxide px-5 py-2.5 font-medium text-paper hover:bg-oxide-deep"
        >
          Connect wallet
        </button>
      </div>
    );
  }

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const valid =
    freelancer.startsWith("G") &&
    freelancer.length === 56 &&
    rows.length >= 2 &&
    rows.length <= 3 &&
    rows.every((r) => r.title.trim() && parseFloat(r.amount) > 0);

  const submit = async () => {
    setShortfall(null);
    // Pre-flight balance check: error state no. 03.
    const available = parseFloat(balance ?? "0");
    if (total + FEE_HEADROOM_XLM > available) {
      setShortfall(
        `This escrow needs ${total} XLM plus ~${FEE_HEADROOM_XLM} XLM fee headroom, ` +
          `but the connected wallet holds ${available} XLM. ` +
          `Short by ${(total + FEE_HEADROOM_XLM - available).toFixed(2)} XLM.`
      );
      return;
    }

    setTx({ phase: "pending", label: "Creating escrow" });
    try {
      const { method, args } = buildCreateEscrowArgs(
        address,
        freelancer,
        TOKEN_CONTRACT,
        rows.map((r) => ({
          title: r.title.trim(),
          stroops: xlmToStroops(r.amount),
        }))
      );
      const hash = await invokeContract(address, method, args, signTx);
      setTx({ phase: "success", hash, label: "Escrow created" });
      await refreshBalance();
      const count = await getEscrowCount();
      setTimeout(() => router.push(`/escrow/?id=${count - 1}`), 2500);
    } catch (e) {
      if (isUserRejection(e)) {
        setTx({ phase: "rejected" });
      } else {
        setTx({
          phase: "failed",
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }
  };

  return (
    <section className="mx-auto max-w-2xl">
      <p className="annotation mb-2">plate ii — new commission</p>
      <h1 className="font-display text-3xl font-semibold">Create escrow</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Funds for every milestone are locked into the contract now and released
        one stone at a time.
      </p>

      <div className="mt-8 space-y-6">
        <label className="block">
          <span className="annotation">freelancer address</span>
          <input
            value={freelancer}
            onChange={(e) => setFreelancer(e.target.value.trim())}
            placeholder="G…"
            className="mt-1 w-full rounded border hairline bg-white/60 px-3 py-2.5 font-mono text-sm focus:border-oxide focus:outline-none"
          />
        </label>

        <div>
          <span className="annotation">milestones ({rows.length}/3)</span>
          <div className="mt-1 space-y-3">
            {rows.map((r, i) => (
              <div key={i} className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={r.title}
                  onChange={(e) => setRow(i, { title: e.target.value })}
                  placeholder={`Milestone ${i + 1} title`}
                  className="flex-1 rounded border hairline bg-white/60 px-3 py-2.5 text-sm focus:border-oxide focus:outline-none"
                />
                <div className="flex gap-2">
                  <input
                    value={r.amount}
                    onChange={(e) => setRow(i, { amount: e.target.value })}
                    placeholder="Amount"
                    inputMode="decimal"
                    className="w-32 rounded border hairline bg-white/60 px-3 py-2.5 text-right font-mono text-sm focus:border-oxide focus:outline-none"
                  />
                  <span className="self-center annotation">XLM</span>
                  {rows.length > 2 && (
                    <button
                      onClick={() =>
                        setRows((rs) => rs.filter((_, j) => j !== i))
                      }
                      className="annotation min-h-11 min-w-11 rounded border hairline px-2 hover:border-oxide hover:text-oxide"
                      aria-label="Remove milestone"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {rows.length < 3 && (
            <button
              onClick={() => setRows((rs) => [...rs, { title: "", amount: "" }])}
              className="mt-3 annotation rounded border hairline px-3 py-2 hover:border-oxide hover:text-oxide"
            >
              + Add milestone
            </button>
          )}
        </div>

        <div className="flex items-baseline justify-between border-t hairline pt-4">
          <span className="annotation">total to lock</span>
          <span className="font-display text-3xl font-semibold">
            {total.toLocaleString()} <span className="text-lg">XLM</span>
          </span>
        </div>

        {shortfall && (
          <div className="rounded border-2 border-dashed border-oxide bg-paper-deep px-4 py-3 text-sm">
            <p className="annotation mb-1">error / no. 03 — insufficient balance</p>
            <p>{shortfall}</p>
          </div>
        )}

        <TxBanner
          state={tx}
          onRetry={submit}
          onDismiss={() => setTx({ phase: "idle" })}
        />

        <button
          onClick={submit}
          disabled={!valid || tx.phase === "pending"}
          className="w-full rounded bg-oxide px-5 py-3 font-medium text-paper hover:bg-oxide-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          {tx.phase === "pending" ? "Locking funds…" : "Lock funds & create"}
        </button>
      </div>
    </section>
  );
}
