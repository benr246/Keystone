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
