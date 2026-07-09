"use client";

import { EXPLORER_TX } from "@/lib/config";

export type TxState =
  | { phase: "idle" }
  | { phase: "pending"; label: string }
  | { phase: "success"; hash: string; label: string }
  | { phase: "rejected" }
  | { phase: "failed"; message: string };

export default function TxBanner({
  state,
  onRetry,
  onDismiss,
}: {
  state: TxState;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  if (state.phase === "idle") return null;

  if (state.phase === "pending") {
    return (
      <div className="rounded border hairline bg-paper-deep px-4 py-3 text-sm">
        <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-oxide border-t-transparent align-middle" />
        {state.label} — waiting for the network…
      </div>
    );
  }

  if (state.phase === "success") {
    return (
      <div className="rounded border border-ok/40 bg-ok/10 px-4 py-3 text-sm">
        <span className="font-medium text-ok">✓ {state.label}.</span>{" "}
        <a
          href={`${EXPLORER_TX}${state.hash}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs underline decoration-dotted"
        >
          {state.hash.slice(0, 10)}…{state.hash.slice(-10)}
        </a>{" "}
        <span className="annotation">view on Stellar Expert</span>
        {onDismiss && (
          <button onClick={onDismiss} className="ml-3 annotation underline">
            dismiss
          </button>
        )}
      </div>
    );
  }

  if (state.phase === "rejected") {
    return (
      <div className="rounded border-2 border-dashed border-oxide bg-paper-deep px-4 py-3 text-sm">
        <p className="annotation mb-1">error / no. 02 — signature declined</p>
        <p>
          The transaction was declined in your wallet. Nothing was submitted —
          your funds are untouched.
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 rounded bg-oxide px-3 py-1.5 text-xs font-medium text-paper hover:bg-oxide-deep"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded border-2 border-dashed border-oxide bg-paper-deep px-4 py-3 text-sm">
      <p className="annotation mb-1">transaction failed</p>
      <p>{state.message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 rounded bg-oxide px-3 py-1.5 text-xs font-medium text-paper hover:bg-oxide-deep"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function isUserRejection(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  return /reject|declin|denied|cancel/i.test(message);
}

/** Map raw contract/RPC errors to human-readable failure text. */
export function friendlyError(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  if (/require_auth|InvalidAction|Auth/i.test(message)) {
    return "Not authorized — only the escrow's client can perform this action.";
  }
  if (/underfunded|insufficient/i.test(message)) {
    return "Insufficient balance to complete this transaction.";
  }
  if (/escrow not found/i.test(message)) {
    return "This escrow id does not exist on the contract.";
  }
  if (/milestone is not locked/i.test(message)) {
    return "That milestone was already released or refunded.";
  }
  if (/nothing to refund/i.test(message)) {
    return "Every milestone is already settled — nothing left to refund.";
  }
  return message;
}
