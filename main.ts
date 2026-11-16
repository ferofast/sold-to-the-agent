#!/usr/bin/env npx tsx
/**
 * $SOLD — "SOLD! To the Agent in the Back"
 *
 * pump.fun coin creator for the make.fun bounty makefun-coin-promo-01.
 *
 * Create-only: mints a brand-new pump.fun coin and NOTHING else. No buy,
 * no swap, no approval, no second instruction that moves funds.
 *
 * Default mode is --simulate: the transaction is built, run against the
 * RPC simulator, and the fee is printed. Nothing is broadcast, no SOL is
 * spent. Pass --execute to broadcast for real (still guarded by a fee cap).
 *
 * Usage:
 *   npx tsx main.ts --simulate [--keypair <path>]
 *   npx tsx main.ts --execute  [--keypair <path>]
 *
 * The mint keypair is generated fresh on every --execute run and saved to
 * ./mint-keypair.json (gitignored, never committed). The create signature
 * and mint address are written to LAUNCH.json after a successful broadcast.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
  SYSVAR_RENT_PUBKEY,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";

const PUMP_PROGRAM_ID = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
/**
 * The classic Metaplex Token Metadata program. The metadata PDA is derived
 * with this program id — that part was always right. (A wrong turn during
 * debugging blamed this constant: the real bug was the missing
 * mplTokenMetadata program account in the create instruction — see below.
 * The simulation error's "Left" was simply the PDA I passed, and "Right"
 * was this program id, because the program read my PDA in the slot where
 * it expects the metadata PROGRAM account.)
 */
const METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
);
const RPC_URL = "https://api.mainnet-beta.solana.com";
const MAX_FEE_SOL = 0.01; // never broadcast if the simulated fee is above this

const HERE = dirname(fileURLToPath(import.meta.url));
const METADATA_PATH = join(HERE, "metadata.json");

function flagValue(argv: string[], flag: string): string | null {
  const i = argv.indexOf(flag);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
}

function discriminator(instruction: string): Buffer {
  return createHash("sha256").update(`global:${instruction}`).digest().subarray(0, 8);
}

function encodeString(value: string): Buffer {
  const bytes = Buffer.from(value, "utf8");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(bytes.length, 0);
  return Buffer.concat([len, bytes]);
}

/**
 * Encodes the pump.fun `create` instruction data.
 *
 * Layout: discriminator (8) + name + symbol + uri (each u32 length + utf8)
 * + creator pubkey (32) + trailing option fields.
 *
 * The trailing fields are OptionBool / OptionU64 values in the IDL. They
 * MUST be encoded as all-zero bytes: encoding a Some(false) as
 * [0x01, 0x00] is read by the program as cashback=TRUE and the transaction
 * fails with error 6082. Eleven zero bytes is the correct encoding.
 */
function encodeCreateData(
  name: string,
  symbol: string,
  uri: string,
  creator: PublicKey,
): Buffer {
  return Buffer.concat([
    discriminator("create"),
    encodeString(name),
    encodeString(symbol),
    encodeString(uri),
    creator.toBuffer(),
    Buffer.alloc(11, 0),
  ]);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const execute = argv.includes("--execute");
  const keypairPath =
    flagValue(argv, "--keypair") ??
    join(process.env.HOME ?? "", "workspace/solana-wallet/autopilot-keypair.json");

  if (!existsSync(METADATA_PATH)) {
    throw new Error(`metadata.json not found next to main.ts (${METADATA_PATH})`);
  }
  const meta = JSON.parse(readFileSync(METADATA_PATH, "utf8")) as {
    name: string;
    symbol: string;
  };
  // pump.fun limits: name ≤ 32 chars, symbol ≤ 10 chars. Fail fast here
  // instead of after building the transaction.
  if (meta.name.length > 32) {
    throw new Error(`coin name is ${meta.name.length} chars (max 32): ${meta.name}`);
  }
  if (meta.symbol.length > 10) {
    throw new Error(`coin symbol is ${meta.symbol.length} chars (max 10): ${meta.symbol}`);
  }
  // The on-chain metadata URI points at this repo's metadata.json, served
  // raw from GitHub. It must be pushed before the create transaction, or
  // pump.fun cannot display the coin.
  const uri = `https://raw.githubusercontent.com/ferofast/sold-to-the-agent/main/metadata.json`;

  const payer = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(keypairPath, "utf8")) as number[]),
  );
  const connection = new Connection(RPC_URL, "confirmed");

  const balance = await connection.getBalance(payer.publicKey);
  console.log(`payer: ${payer.publicKey.toBase58()}`);
  console.log(`balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  if (balance / LAMPORTS_PER_SOL < 0.01) {
    throw new Error("payer balance below 0.01 SOL — top up before creating");
  }

  // Best-effort reachability check on the metadata URI. The chain never
  // fetches it, so a network failure here is a warning, not a blocker —
  // but a bad URI means the coin would launch with no logo or description.
  try {
    const res = await fetch(uri, { method: "HEAD" });
    console.log(`metadata URI HEAD: ${res.status} ${res.ok ? "(reachable)" : "(WARNING: not reachable)"}`);
  } catch (err) {
    console.log(`metadata URI HEAD failed (${(err as Error).message}) — continuing; verify the repo is pushed`);
  }

  const mint = Keypair.generate();
  console.log(`mint (fresh): ${mint.publicKey.toBase58()}`);

  const [globalPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global")],
    PUMP_PROGRAM_ID,
  );
  // The token's mint authority is NOT the creator — it is the program's
  // PDA derived from ["mint-authority"]. Passing the payer here fails the
  // seeds constraint (Anchor error 2006). The PDA signs via invoke_signed
  // inside the program, so it is passed as a plain non-signer account.
  const [mintAuthorityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("mint-authority")],
    PUMP_PROGRAM_ID,
  );
  const [bondingCurve] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"), mint.publicKey.toBuffer()],
    PUMP_PROGRAM_ID,
  );
  const associatedBondingCurve = await getAssociatedTokenAddress(
    mint.publicKey,
    bondingCurve,
    true,
  );
  const [metadataPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      METADATA_PROGRAM_ID.toBuffer(),
      mint.publicKey.toBuffer(),
    ],
    METADATA_PROGRAM_ID,
  );
  const [eventAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("__event_authority")],
    PUMP_PROGRAM_ID,
  );

  const createIx = new TransactionInstruction({
    programId: PUMP_PROGRAM_ID,
    // FOURTEEN accounts. The easy one to miss is mplTokenMetadata — the
    // metadata PROGRAM account, which sits between `global` and the
    // `metadata` PDA. Leaving it out shifts every later account by one,
    // and the program then reads the metadata PDA in the program's slot
    // and fails with Anchor error 3008 (InvalidProgramId).
    keys: [
      { pubkey: mint.publicKey, isSigner: true, isWritable: true },
      { pubkey: mintAuthorityPda, isSigner: false, isWritable: false },
      { pubkey: bondingCurve, isSigner: false, isWritable: true },
      { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
      { pubkey: globalPda, isSigner: false, isWritable: true },
      { pubkey: METADATA_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: metadataPda, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: eventAuthority, isSigner: false, isWritable: false },
      { pubkey: PUMP_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: encodeCreateData(meta.name, meta.symbol, uri, payer.publicKey),
  });

  // The pump program creates AND initializes the mint account itself via
  // CPI (system Allocate + token InitializeMint), using the mint keypair
  // as signer. The client must NOT pre-create the mint: sending a
  // createAccount + InitializeMint2 first makes the program's own
  // Allocate fail with "already in use" (custom error 0x0). So the
  // transaction is a single instruction — the create.
  const tx = new Transaction().add(createIx);
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  const fee = (await connection.getFeeForMessage(tx.compileMessage())).value ?? 0;
  // This is the network fee only. The create also pays rent for the mint
  // + metadata accounts (~0.0057 SOL in round 1, total ~0.0058 SOL).
  console.log(`network fee: ${fee / LAMPORTS_PER_SOL} SOL (rent ~0.0057 SOL on top, total ~0.0058 SOL)`);

  // Sign BEFORE simulating: an unsigned transaction fails simulation.
  // NOTE: web3.js's legacy-Transaction overload takes the signers ARRAY
  // as the second argument — passing a config object like { sigVerify }
  // throws "Invalid arguments" client-side before any RPC call.
  tx.sign(payer, mint);
  console.log(
    `tx: ${tx.instructions.length} instructions, ` +
      `data lens: ${tx.instructions.map((ix) => ix.data.length).join(",")}, ` +
      `accounts: ${tx.compileMessage().accountKeys.length}`,
  );
  let sim;
  try {
    sim = await connection.simulateTransaction(tx, [payer, mint]);
  } catch (err) {
    console.log("simulateTransaction RPC error:", JSON.stringify(err, Object.getOwnPropertyNames(err as object), 2));
    throw err;
  }
  if (sim.value.err) {
    console.log("simulation FAILED:", JSON.stringify(sim.value.err));
    console.log("logs:", (sim.value.logs ?? []).join("\n"));
    throw new Error("simulation failed — fix the transaction before executing");
  }
  console.log("simulation OK");

  if (!execute) {
    console.log("SIMULATION ONLY — nothing broadcast. Re-run with --execute to create the coin.");
    console.log(`coin page (after create): https://pump.fun/coin/${mint.publicKey.toBase58()}`);
    return;
  }

  if (fee / LAMPORTS_PER_SOL > MAX_FEE_SOL) {
    throw new Error(`fee ${fee / LAMPORTS_PER_SOL} SOL exceeds cap ${MAX_FEE_SOL} SOL — aborting`);
  }
  const signature = await sendAndConfirmTransaction(connection, tx, [payer, mint]);
  console.log(`CREATED: https://pump.fun/coin/${mint.publicKey.toBase58()}`);
  console.log(`signature: ${signature}`);
  writeFileSync(
    join(HERE, "mint-keypair.json"),
    JSON.stringify(Array.from(mint.secretKey)),
  );
  writeFileSync(
    join(HERE, "LAUNCH.json"),
    JSON.stringify({ mint: mint.publicKey.toBase58(), create_signature: signature }, null, 2) + "\n",
  );
  console.log("wrote mint-keypair.json (gitignored) and LAUNCH.json");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
