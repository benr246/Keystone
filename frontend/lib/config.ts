export const ESCROW_CONTRACT =
  process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS ?? "";
export const TOKEN_CONTRACT =
  process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS ?? "";
export const NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet";
export const RPC_URL =
  process.env.NEXT_PUBLIC_STELLAR_RPC_URL ??
  "https://soroban-testnet.stellar.org:443";

export const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
export const HORIZON_URL = "https://horizon-testnet.stellar.org";
export const EXPLORER_TX = "https://stellar.expert/explorer/testnet/tx/";
export const EXPLORER_CONTRACT =
  "https://stellar.expert/explorer/testnet/contract/";

// Any funded account works as a phantom source for read-only simulations.
export const SIM_ACCOUNT =
  "GB5U4TGVNNNJWIMSJB2WOH3SNFUXPC462YBJMWKE5AXCIVU34GKWJKLQ";

export const STROOPS_PER_XLM = 10_000_000n;

export function stroopsToXlm(stroops: bigint): string {
  const whole = stroops / STROOPS_PER_XLM;
  const frac = (stroops % STROOPS_PER_XLM).toString().padStart(7, "0");
  const trimmed = frac.replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole.toString();
}

export function xlmToStroops(xlm: string): bigint {
  const [whole, frac = ""] = xlm.split(".");
  return (
    BigInt(whole || "0") * STROOPS_PER_XLM +
    BigInt((frac + "0000000").slice(0, 7))
  );
}

export function shortAddr(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-6)}` : addr;
}
