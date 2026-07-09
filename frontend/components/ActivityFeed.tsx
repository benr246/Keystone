"use client";

import useSWR from "swr";
import { getEscrowEvents, EscrowEvent } from "@/lib/soroban";
import { EXPLORER_TX, stroopsToXlm } from "@/lib/config";

function describe(ev: EscrowEvent): string {
  if (ev.kind === "created") {
    const total = ev.data[3] as bigint;
    return `Escrow №${ev.escrowId} created — ${stroopsToXlm(total)} XLM locked`;
  }
  if (ev.kind === "released") {
    const index = Number(ev.data[1]);
    const amount = ev.data[2] as bigint;
    return `Milestone ${index + 1} released — ${stroopsToXlm(amount)} XLM paid`;
  }
  const refunded = ev.data[1] as bigint;
  return `Escrow №${ev.escrowId} cancelled — ${stroopsToXlm(refunded)} XLM refunded`;
}

export default function ActivityFeed({ escrowId }: { escrowId?: number }) {
  const { data: events, error } = useSWR("escrow-events", getEscrowEvents, {
    refreshInterval: 5000,
  });

  const rows =
    escrowId === undefined
      ? events
      : events?.filter((e) => e.escrowId === escrowId);

  return (
    <div>
      <div className="flex items-baseline justify-between border-b hairline pb-2">
        <h2 className="font-display text-xl font-semibold">Site log</h2>
        <span className="annotation">live · polled every 5s</span>
      </div>
      {error && (
        <p className="mt-4 text-sm text-ink-soft">
          Could not load events right now — retrying automatically.
        </p>
      )}
      {rows && rows.length === 0 && (
        <p className="mt-4 text-sm text-ink-soft">
          No on-chain events in the recent ledger window.
        </p>
      )}
      <ul>
        {rows?.map((ev) => (
          <li
            key={ev.txHash + ev.kind}
            className="flex flex-col gap-1 border-b hairline py-3 text-sm sm:flex-row sm:items-baseline sm:justify-between"
          >
            <span>
              <span
                className={
                  ev.kind === "released"
                    ? "text-oxide font-medium"
                    : ev.kind === "cancelled"
                      ? "text-ink-soft"
                      : ""
                }
              >
                {describe(ev)}
              </span>
            </span>
            <a
              href={`${EXPLORER_TX}${ev.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="annotation underline decoration-dotted"
            >
              {ev.txHash.slice(0, 8)}… ledger {ev.ledger}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
