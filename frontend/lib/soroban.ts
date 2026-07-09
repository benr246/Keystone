import {
  Account,
  BASE_FEE,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import {
  ESCROW_CONTRACT,
  NETWORK_PASSPHRASE,
  RPC_URL,
  SIM_ACCOUNT,
} from "./config";

export type MilestoneView = {
  title: string;
  amount: bigint;
  status: "Locked" | "Released" | "Refunded";
};

export type EscrowView = {
  id: number;
  client: string;
  freelancer: string;
  token: string;
  milestones: MilestoneView[];
  cancelled: boolean;
  created_at: bigint;
};

export function getServer() {
  return new rpc.Server(RPC_URL);
}

function statusOf(raw: unknown): MilestoneView["status"] {
  if (typeof raw === "string") return raw as MilestoneView["status"];
  if (Array.isArray(raw)) return String(raw[0]) as MilestoneView["status"];
  return String(raw) as MilestoneView["status"];
}

async function simulateRead(method: string, args: xdr.ScVal[]) {
  const server = getServer();
  const contract = new Contract(ESCROW_CONTRACT);
  const source = new Account(SIM_ACCOUNT, "0");
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error);
  }
  const result = (sim as rpc.Api.SimulateTransactionSuccessResponse).result;
  if (!result) throw new Error("no result from simulation");
  return scValToNative(result.retval);
}

export async function getEscrowCount(): Promise<number> {
  const n = await simulateRead("get_escrow_count", []);
  return Number(n);
}

export async function getEscrow(id: number): Promise<EscrowView> {
  const raw = await simulateRead("get_escrow", [
    nativeToScVal(BigInt(id), { type: "u64" }),
  ]);
  return {
    id,
    client: raw.client,
    freelancer: raw.freelancer,
    token: raw.token,
    cancelled: raw.cancelled,
    created_at: raw.created_at,
    milestones: raw.milestones.map(
      (m: { title: string; amount: bigint; status: unknown }) => ({
        title: m.title,
        amount: m.amount,
        status: statusOf(m.status),
      })
    ),
  };
}

export async function getProgress(
  id: number
): Promise<{ released: bigint; locked: bigint }> {
  const [released, locked] = await simulateRead("get_progress", [
    nativeToScVal(BigInt(id), { type: "u64" }),
  ]);
  return { released, locked };
}

export async function listEscrowsFor(address: string): Promise<EscrowView[]> {
  const count = await getEscrowCount();
  const ids = Array.from({ length: count }, (_, i) => i);
  const all = await Promise.all(
    ids.map((id) => getEscrow(id).catch(() => null))
  );
  return all.filter(
    (e): e is EscrowView =>
      e !== null && (e.client === address || e.freelancer === address)
  );
}

export function buildCreateEscrowArgs(
  client: string,
  freelancer: string,
  token: string,
  milestones: { title: string; stroops: bigint }[]
): { method: string; args: xdr.ScVal[] } {
  return {
    method: "create_escrow",
    args: [
      nativeToScVal(client, { type: "address" }),
      nativeToScVal(freelancer, { type: "address" }),
      nativeToScVal(token, { type: "address" }),
      xdr.ScVal.scvVec(
        milestones.map((m) =>
          xdr.ScVal.scvVec([
            nativeToScVal(m.title, { type: "string" }),
            nativeToScVal(m.stroops, { type: "i128" }),
          ])
        )
      ),
    ],
  };
}

export function buildReleaseArgs(id: number, index: number) {
  return {
    method: "release_milestone",
    args: [
      nativeToScVal(BigInt(id), { type: "u64" }),
      nativeToScVal(index, { type: "u32" }),
    ],
  };
}

export function buildCancelArgs(id: number) {
  return {
    method: "cancel_escrow",
    args: [nativeToScVal(BigInt(id), { type: "u64" })],
  };
}

export type SignFn = (xdrBase64: string) => Promise<string>;

/** Build, prepare, sign (via wallet), send and await a contract invocation. */
export async function invokeContract(
  publicKey: string,
  method: string,
  args: xdr.ScVal[],
  sign: SignFn
): Promise<string> {
  const server = getServer();
  const contract = new Contract(ESCROW_CONTRACT);
  const account = await server.getAccount(publicKey);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(120)
    .build();

  const prepared = await server.prepareTransaction(tx);
  const signedXdr = await sign(prepared.toXDR());
  const signed = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  const sent = await server.sendTransaction(signed);
  if (sent.status === "ERROR") {
    throw new Error(`transaction submission failed: ${sent.errorResult}`);
  }

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await server.getTransaction(sent.hash);
    if (res.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return sent.hash;
    }
    if (res.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error("transaction failed on-chain");
    }
  }
  throw new Error("timed out waiting for transaction confirmation");
}

export type EscrowEvent = {
  kind: "created" | "released" | "cancelled";
  escrowId: number;
  txHash: string;
  ledger: number;
  data: unknown[];
};

/** Poll contract events for the escrow contract within RPC retention. */
export async function getEscrowEvents(): Promise<EscrowEvent[]> {
  const server = getServer();
  const latest = await server.getLatestLedger();
  let window = 100_000;
  for (;;) {
    try {
      const res = await server.getEvents({
        startLedger: Math.max(1, latest.sequence - window),
        filters: [{ type: "contract", contractIds: [ESCROW_CONTRACT] }],
        limit: 100,
      });
      const events: EscrowEvent[] = [];
      for (const ev of res.events) {
        const topics = ev.topic.map((t) => scValToNative(t));
        if (topics[0] !== "escrow") continue;
        const kind = topics[1] as EscrowEvent["kind"];
        const data = scValToNative(ev.value) as unknown[];
        events.push({
          kind,
          escrowId: Number(Array.isArray(data) ? data[0] : data),
          txHash: ev.txHash,
          ledger: ev.ledger,
          data: Array.isArray(data) ? data : [data],
        });
      }
      return events.reverse(); // newest first
    } catch (e) {
      window = Math.floor(window / 4);
      if (window < 1000) throw e;
    }
  }
}
